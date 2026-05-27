/**
 * PlatformAdminService
 *
 * Detects when the platform owner messages a workspace's WhatsApp/Telegram channel
 * and routes them to a special admin AI with no business restrictions.
 *
 * Configuration (env vars):
 *   PLATFORM_ADMIN_PHONES  — comma-separated phone numbers of platform admins
 *                            e.g. "+50688888888,+50677777777" or "50688888888"
 *   PLATFORM_ADMIN_AI_MODEL — AI model to use for admin chat
 *                            defaults to SYSTEM_AI_MODEL or "mimo/mimo-v2.5-pro"
 */
import { Injectable, Logger, Optional, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import { AiGatewayService } from "./ai-gateway.service";
import type { AssistantMessage } from "./cloudflare-ai.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { TelegramOutboundService } from "../telegram/telegram-outbound.service";

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  /** Normalised phone numbers of platform admins (digits only, no spaces/+ etc.) */
  private readonly adminPhones: Set<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway?: AiGatewayService,
    @Optional() @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp?: WhatsAppService,
    @Optional()
    private readonly telegramOutbound?: TelegramOutboundService,
  ) {
    const raw = config.get<string>("PLATFORM_ADMIN_PHONES") ?? "";
    this.adminPhones = new Set(
      raw
        .split(",")
        .map((p) => p.trim().replace(/\D/g, ""))
        .filter((p) => p.length >= 7),
    );
    if (this.adminPhones.size > 0) {
      this.logger.log(`[platform-admin] ${this.adminPhones.size} admin phone(s) registered`);
    }
  }

  /**
   * Returns true if the given phone number belongs to a platform admin.
   * Handles both exact match and suffix match (country-code prefix differences).
   */
  isPlatformAdmin(phone: string): boolean {
    if (this.adminPhones.size === 0) return false;
    const normalized = phone.replace(/\D/g, "");
    return (
      this.adminPhones.has(normalized) ||
      [...this.adminPhones].some(
        (p) => normalized.endsWith(p) || p.endsWith(normalized),
      )
    );
  }

  /**
   * Handle an inbound message from a platform admin.
   * Bypasses all business logic and responds with a platform-level AI.
   */
  async handleAdminMessage(params: {
    workspaceId: string;
    conversationId: string;
    phone: string;
    text: string;
    channelId: string;
    channelType: string;
  }): Promise<void> {
    const { workspaceId, conversationId, phone, text, channelId, channelType } = params;

    if (!this.gateway) {
      this.logger.warn("[platform-admin] AiGatewayService not injected — cannot reply");
      return;
    }

    // ── System prompt: no business restrictions ──────────────────────────────
    const systemPrompt = `Eres el asistente de administración de la plataforma PymesHub.
Estás hablando directamente con el administrador de la plataforma (dueño del sistema).
Workspace activo: ${workspaceId}
Canal: ${channelType}

MODO ADMINISTRADOR — sin restricciones de negocio, sin prompt de cliente.

Puedes ayudar con cualquier consulta:
- Configuración de workspaces, planes, facturación
- Pruebas de IA: modelos, proveedores, prompts
- Estado técnico del sistema
- Gestión de usuarios y contactos
- Cualquier solicitud operativa

Responde en español salvo que el admin use otro idioma.
Sé directo, técnico y conciso — el admin conoce el sistema.
No uses el formato de "asistente de empresa" ni frases como "¿En qué puedo ayudarte?".`;

    // ── Conversation history ─────────────────────────────────────────────────
    const recentMessages = await this.prisma.message.findMany({
      where: { conversation_id: conversationId },
      orderBy: { sent_at: "desc" },
      take: 12,
      select: { direction: true, body_text: true },
    });

    const history: AssistantMessage[] = recentMessages
      .reverse()
      .filter((m) => m.body_text)
      .map((m) => ({
        role: m.direction === "OUTBOUND" ? "assistant" : "user",
        content: m.body_text!,
      }));

    const messages: AssistantMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    // ── AI call ──────────────────────────────────────────────────────────────
    const model =
      this.config.get<string>("PLATFORM_ADMIN_AI_MODEL") ??
      this.config.get<string>("SYSTEM_AI_MODEL") ??
      "mimo/mimo-v2.5-pro";

    let response: string;
    try {
      response = await this.gateway.chatCompletion(messages, {
        model,
        maxTokens: 1500,
        temperature: 0.4,
      });
    } catch (err) {
      this.logger.error("[platform-admin] AI call failed", err);
      response = "❌ Error al procesar tu mensaje. Revisa los logs del servidor.";
    }

    // ── Store in DB ──────────────────────────────────────────────────────────
    await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: "OUTBOUND",
        sender_name: "PymesHub Admin",
        sender_ref: "platform-admin@pymeshub",
        body_text: response,
        sent_at: new Date(),
        delivery_status: "SENT",
        message_type: "TEXT",
        has_media: false,
        media_status: "NONE",
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { last_message_at: new Date(), updated_at: new Date() },
      select: { id: true },
    });

    this.logger.log(`[platform-admin] replied to conv=${conversationId} workspace=${workspaceId}`);

    // ── Dispatch to channel ──────────────────────────────────────────────────
    if (channelType === "WHATSAPP" && this.whatsapp) {
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, type: true, config_json: true },
      });
      if (channel) {
        const to = phone.replace(/\D/g, "");
        this.whatsapp
          .sendMessage(channel as Record<string, any>, to, response)
          .catch((err) =>
            this.logger.error("[platform-admin] WA dispatch failed", err),
          );
      }
    }

    if (channelType === "TELEGRAM" && this.telegramOutbound) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { contact: { select: { telegram_chat_id: true } } },
      });
      const chatId = conv?.contact?.telegram_chat_id;
      if (chatId) {
        this.telegramOutbound
          .sendMessage(channelId, chatId, response)
          .catch((err) =>
            this.logger.error("[platform-admin] Telegram dispatch failed", err),
          );
      }
    }
  }
}
