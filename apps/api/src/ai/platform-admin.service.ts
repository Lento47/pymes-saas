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
import { PlatformSettingsService } from "../platform/platform-settings.service";

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  /** Env-var fallback phones (digits only) */
  private readonly envAdminPhones: Set<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway?: AiGatewayService,
    @Optional() @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp?: WhatsAppService,
    @Optional()
    private readonly telegramOutbound?: TelegramOutboundService,
    @Optional()
    private readonly platformSettings?: PlatformSettingsService,
  ) {
    const raw = config.get<string>("PLATFORM_ADMIN_PHONES") ?? "";
    this.envAdminPhones = new Set(
      raw
        .split(",")
        .map((p) => p.trim().replace(/\D/g, ""))
        .filter((p) => p.length >= 7),
    );
    if (this.envAdminPhones.size > 0) {
      this.logger.log(`[platform-admin] ${this.envAdminPhones.size} admin phone(s) from env`);
    }
  }

  /**
   * Returns true if the given phone number belongs to a platform admin.
   * Checks DB phones first (configured via UI), then env var fallback.
   */
  async isPlatformAdmin(phone: string): Promise<boolean> {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 7) return false;

    // DB phones (UI-configured) take priority
    if (this.platformSettings) {
      try {
        const cfg = await this.platformSettings.getDecrypted();
        if (cfg.admin_phones) {
          const dbPhones = cfg.admin_phones
            .split(",")
            .map((p) => p.trim().replace(/\D/g, ""))
            .filter((p) => p.length >= 7);
          if (this.phoneMatches(normalized, new Set(dbPhones))) return true;
        }
      } catch {
        // DB unavailable — fall through to env fallback
      }
    }

    // Env var fallback
    return this.phoneMatches(normalized, this.envAdminPhones);
  }

  private phoneMatches(normalized: string, phones: Set<string>): boolean {
    if (phones.size === 0) return false;
    return (
      phones.has(normalized) ||
      [...phones].some((p) => normalized.endsWith(p) || p.endsWith(normalized))
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

    // ── Resolve model + MiMo API key from DB (UI-configured), fallback to env ──
    let model =
      this.config.get<string>("PLATFORM_ADMIN_AI_MODEL") ??
      this.config.get<string>("SYSTEM_AI_MODEL") ??
      "mimo/mimo-v2.5-pro";
    let mimoApiKey: string | undefined;

    if (this.platformSettings) {
      try {
        const cfg = await this.platformSettings.getDecrypted();
        if (cfg.admin_ai_model) model = cfg.admin_ai_model;
        if (cfg.mimo_api_key)   mimoApiKey = cfg.mimo_api_key;
        this.logger.debug(
          `[platform-admin] DB cfg resolved — model=${model} mimo_key_set=${!!mimoApiKey}`,
        );
      } catch (err: any) {
        this.logger.warn(`[platform-admin] getDecrypted failed: ${err?.message ?? err}`);
        // fall through to env defaults
      }
    } else {
      this.logger.warn("[platform-admin] PlatformSettingsService not injected — using env fallback");
    }

    // If the selected model is a MiMo direct model but no API key is available
    // (neither from DB nor from env), fall back to a CF-gateway model so the
    // admin chat still responds instead of failing silently.
    const isMimoModel = model.startsWith("mimo/");
    const envMimoKey = this.config.get<string>("DIRECT_KEY_MIMO");
    if (isMimoModel && !mimoApiKey && !envMimoKey) {
      const fallback =
        this.config.get<string>("SYSTEM_AI_MODEL") ??
        "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      this.logger.warn(
        `[platform-admin] No MiMo API key found — falling back to ${fallback}. ` +
        `Configure the key at /settings/platform or set DIRECT_KEY_MIMO env var.`,
      );
      model = fallback;
    }

    let response: string;
    // MiMo thinking models (v2.5-pro, v2.5, v2-pro, v2-omni) use temperature 1.0
    // by default and override any custom value internally. Using 1.0 aligns with
    // their docs for "General Conversation" tasks.
    const isMimoThinkingModel = /mimo\/(mimo-)?v2(\.\d+)?(-pro|-omni)?$|mimo\/(mimo-)?v2\.\d+-pro/.test(model);
    const temperature = isMimoThinkingModel ? 1.0 : 0.7;

    try {
      response = await this.gateway.chatCompletion(messages, {
        model,
        maxTokens: 1500,
        temperature,
        ...(mimoApiKey ? { apiKey: mimoApiKey } : {}),
      });
    } catch (err: any) {
      // Extract HTTP status from error message for better diagnostics
      const statusHint = err?.message?.match(/\b(\d{3})\b/)?.[1] ?? "?";
      this.logger.error(
        `[platform-admin] MiMo call failed (model=${model}, status=${statusHint}): ${err?.message ?? err}`,
      );

      // Fall back on ANY MiMo error — retry once with CF gateway
      const cfFallback =
        this.config.get<string>("SYSTEM_AI_MODEL") ??
        "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      this.logger.warn(
        `[platform-admin] Falling back to CF gateway model: ${cfFallback}`,
      );
      await new Promise((r) => setTimeout(r, 800));
      try {
        // No temperature for workers-ai — let it use its own default
        response = await this.gateway.chatCompletion(messages, {
          model: cfFallback,
          maxTokens: 1500,
        });
      } catch (fallbackErr: any) {
        this.logger.error(
          `[platform-admin] Fallback also failed: ${fallbackErr?.message ?? fallbackErr}`,
        );
        response =
          statusHint === "429"
            ? "⚠️ Límite de peticiones en MiMo. Intenta de nuevo en un momento."
            : `❌ Error ${statusHint} al procesar tu mensaje. Revisa los logs del servidor.`;
      }
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
