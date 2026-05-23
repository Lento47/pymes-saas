import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CloudflareAiService, AssistantMessage, ChatCompletionWithUsage } from "./cloudflare-ai.service";
import { AiProviderBalancerService } from "./ai-provider-balancer.service";
import { AiGatewayService } from "./ai-gateway.service";
import { EmrendeAiService } from "./emprende-ai.service";
import { EventsGateway } from "../gateways/events.gateway";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { TelegramOutboundService } from "../telegram/telegram-outbound.service";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { ContactMemoryService } from "../memory/contact-memory.service";
import { AiTokenMeteringService, AiTokenBalanceSnapshot } from "../ai-tokens/ai-token-metering.service";
import { parseJsonValue } from "../common/prisma/json";

type SupportedInteractive =
  | {
      type: "button";
      body: string;
      footer?: string;
      buttons: Array<{ id: string; title: string }>;
    }
  | {
      type: "list";
      body: string;
      footer?: string;
      buttonText?: string;
      sections: Array<{
        title?: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
    }
  | {
      type: "location_request";
      body: string;
    };

interface AiControlAction {
  reply_text: string;
  interactive?: SupportedInteractive | null;
  memory_updates?: {
    summary?: string;
    common_requests?: string[];
    communication_style?: string;
    preferences?: Record<string, string>;
  } | null;
  handoff_reason?: string | null;
}

interface ConversationShape {
  id: string;
  metadata_json: unknown;
  channel_id: string | null;
  contact: {
    id: string;
    full_name: string | null;
    phone: string | null;
    telegram_chat_id: string | null;
  } | null;
  channel: { id: string; type: string; config_json: unknown } | null;
}

interface ReplyOptions {
  activate?: boolean;
  triggerText?: string;
  source?: "manual_start" | "auto_reply";
}

@Injectable()
export class AiConversationControlService {
  private readonly logger = new Logger(AiConversationControlService.name);
  private readonly maxTokens = 1200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflare: CloudflareAiService,
    private readonly emprendeAi: EmrendeAiService,
    private readonly events: EventsGateway,
    private readonly whatsapp: WhatsAppService,
    private readonly telegramOutbound: TelegramOutboundService,
    private readonly planLimits: PlanLimitsService,
    private readonly contactMemory: ContactMemoryService,
    private readonly aiTokens: AiTokenMeteringService,
    private readonly balancer: AiProviderBalancerService,
    private readonly gateway: AiGatewayService,
  ) {}

  async startControl(workspaceId: string, conversationId: string) {
    const lastInbound = await this.prisma.message.findFirst({
      where: { workspace_id: workspaceId, conversation_id: conversationId, direction: "INBOUND" },
      orderBy: { sent_at: "desc" },
      select: { body_text: true },
    });

    return this.replyToInbound(workspaceId, conversationId, lastInbound?.body_text ?? "", {
      activate: true,
      source: "manual_start",
    });
  }

  async stopControl(workspaceId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: { metadata_json: true },
    });
    if (!conv) throw new NotFoundException("Conversación no encontrada.");

    const meta = parseJsonValue<Record<string, unknown>>(conv.metadata_json, {});
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata_json: {
          ...meta,
          ai_state: "HUMAN_ACTIVE",
          ai_control_stopped_at: new Date().toISOString(),
        } as any,
        updated_at: new Date(),
      },
      select: { id: true },
    });

    return { ok: true, ai_state: "HUMAN_ACTIVE" };
  }

  async replyToInbound(
    workspaceId: string,
    conversationId: string,
    inboundText: string,
    options: ReplyOptions = {},
  ): Promise<{
    ok: boolean;
    error?: string;
    message?: Record<string, any>;
    usage?: ChatCompletionWithUsage;
    balance?: AiTokenBalanceSnapshot;
    ai_state?: string;
  }> {
    await this.planLimits.enforcePlanTier(workspaceId, "EMPRENDE", "Agente IA conversacional");
    if (!this.cloudflare.isConfigured && !this.gateway.isConfigured) {
      return { ok: false, error: "AI_NOT_CONFIGURED", balance: await this.aiTokens.getBalance(workspaceId) };
    }

    const conv = await this.getConversation(workspaceId, conversationId);
    const meta = parseJsonValue<Record<string, unknown>>(conv.metadata_json, {});
    if (!options.activate && meta.ai_state !== "AI_ACTIVE") {
      return { ok: false, error: "AI_NOT_ACTIVE", balance: await this.aiTokens.getBalance(workspaceId) };
    }

    await this.persistInboundMemory(workspaceId, conv, inboundText);

    const context = await this.buildPrompt(workspaceId, conv, inboundText);
    const reservation = await this.aiTokens.reserveTokens(
      workspaceId,
      this.aiTokens.estimateMessagesTokens(context.messages, this.maxTokens),
      {
        conversationId,
        description: "Reserva Agente IA conversacional",
        metadata: { source: options.source ?? "auto_reply" },
      },
    );

    if (!reservation.success || !reservation.reservationId) {
      return {
        ok: false,
        error: "INSUFFICIENT_AI_TOKENS",
        balance: reservation.balance,
        ai_state: String(meta.ai_state ?? "IDLE"),
      };
    }

    let completion: ChatCompletionWithUsage;
    try {
      completion = await this.balancer.chatCompletionWithUsage(context.messages, context.providers, {
        maxTokens: this.maxTokens,
        temperature: 0.2,
      });
    } catch (err) {
      await this.aiTokens.releaseReservation(workspaceId, reservation.reservationId);
      this.logger.warn(`AI control provider failed: ${(err as Error).message}`);
      return {
        ok: false,
        error: "AI_PROVIDER_FAILED",
        balance: await this.aiTokens.getBalance(workspaceId),
      };
    }

    const action = this.parseAction(completion.text);
    if (!action.reply_text.trim()) {
      this.logger.warn(`EMPTY_AI_REPLY raw completion: "${completion.text?.slice(0, 500)}"`);
      await this.aiTokens.releaseReservation(workspaceId, reservation.reservationId);
      return {
        ok: false,
        error: "EMPTY_AI_REPLY",
        balance: await this.aiTokens.getBalance(workspaceId),
      };
    }

    const normalizedInteractive = this.normalizeInteractive(action.interactive, conv);
    const message = await this.createAiMessage(
      workspaceId,
      conversationId,
      action.reply_text,
      normalizedInteractive,
      completion,
    );

    const balance = await this.aiTokens.consumeReservation(
      workspaceId,
      reservation.reservationId,
      completion,
      {
        conversationId,
        messageId: message.id,
        description: "Consumo Agente IA conversacional",
        metadata: { source: options.source ?? "auto_reply" },
      },
    );

    await this.persistActionMemory(workspaceId, conv, action);
    const dispatched = await this.dispatchMessage(conv, message, action.reply_text, normalizedInteractive);
    const finalMessage = dispatched ?? message;

    const now = new Date().toISOString();
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        last_message_at: new Date(),
        updated_at: new Date(),
        metadata_json: {
          ...meta,
          ai_state: action.handoff_reason ? "HUMAN_ACTIVE" : "AI_ACTIVE",
          last_ai_reply_at: now,
          ai_control: {
            active: !action.handoff_reason,
            last_usage: {
              prompt_tokens: completion.prompt_tokens,
              completion_tokens: completion.completion_tokens,
              total_tokens: completion.total_tokens,
              estimated: completion.estimated,
              provider: completion.provider,
              model: completion.model,
              at: now,
            },
          },
        } as any,
      },
      select: { id: true },
    });

    const serialized = this.serializeMessage(finalMessage);
    this.events.emitNewMessage(conversationId, workspaceId, serialized);
    return {
      ok: true,
      message: serialized,
      usage: completion,
      balance,
      ai_state: action.handoff_reason ? "HUMAN_ACTIVE" : "AI_ACTIVE",
    };
  }

  private async getConversation(workspaceId: string, conversationId: string): Promise<ConversationShape> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: {
        id: true,
        metadata_json: true,
        channel_id: true,
        contact: { select: { id: true, full_name: true, phone: true, telegram_chat_id: true } },
        channel: { select: { id: true, type: true, config_json: true } },
      },
    });
    if (!conv) throw new NotFoundException("Conversación no encontrada.");
    return conv as ConversationShape;
  }

  private async buildPrompt(workspaceId: string, conv: ConversationShape, inboundText: string) {
    const [ctx, recentMessages, memory, templates] = await Promise.all([
      this.emprendeAi.buildBusinessContext(workspaceId),
      this.prisma.message.findMany({
        where: { workspace_id: workspaceId, conversation_id: conv.id },
        orderBy: { sent_at: "desc" },
        take: 10,
        select: { direction: true, body_text: true },
      }),
      conv.contact?.id ? this.contactMemory.getActiveProfile(conv.contact.id).catch(() => null) : null,
      this.prisma.messageTemplate.findMany({
        where: { workspace_id: workspaceId, channel: "WHATSAPP", status: "APPROVED" as any },
        take: 5,
        orderBy: { updated_at: "desc" },
        select: { name: true, external_template_id: true, body: true },
      }),
    ]);

    const channelType = conv.channel?.type ?? "UNKNOWN";
    const supportsWhatsAppRich = channelType === "WHATSAPP";
    const recent = recentMessages
      .reverse()
      .map((m) => `${m.direction === "INBOUND" ? "Cliente" : "Negocio"}: ${m.body_text ?? ""}`)
      .join("\n");
    const templateContext = templates.length
      ? templates.map((t) => `- ${t.name}: ${t.body.slice(0, 180)}`).join("\n")
      : "Sin templates aprobados disponibles.";

    const system = `${this.emprendeAi.buildSystemPrompt(ctx)}

Toma control conversacional de esta conversación. Responde el primer mensaje aunque sea un saludo.
No dependas de detectar intención estructurada. Tu trabajo es avanzar la conversación y pedir la siguiente información útil.
Si el canal es WhatsApp puedes usar botones, listas o solicitud de ubicación cuando ayude.
Si no sabes algo, no inventes precios, inventario ni disponibilidad.
Responde SOLO JSON válido con este shape:
{
  "reply_text": "texto que se enviará al cliente",
  "interactive": null | { "type": "button", "body": "...", "buttons": [{"id":"...", "title":"..."}] } | { "type": "list", "body":"...", "buttonText":"Ver opciones", "sections":[{"title":"...", "rows":[{"id":"...", "title":"...", "description":"..."}]}] } | { "type": "location_request", "body":"..." },
  "memory_updates": null | { "summary": "...", "common_requests": ["..."], "communication_style": "...", "preferences": {"clave":"valor"} },
  "handoff_reason": null
}
Reglas de interactive:
- Usa interactive solo si el canal lo soporta.
- Botones: máximo 3, títulos cortos.
- Listas: opciones claras, máximo 8 filas.
- Location request: solo si necesitas ubicación para entrega, visita o servicio a domicilio.
- No incluyas markdown fuera del JSON.`;

    const user = `Canal: ${channelType}
Rich WhatsApp disponible: ${supportsWhatsAppRich ? "sí" : "no"}
Cliente: ${conv.contact?.full_name ?? "Cliente"}
Memoria previa: ${memory ? JSON.stringify(memory).slice(0, 1200) : "Sin memoria activa"}
Templates aprobados:
${templateContext}

Conversación reciente:
${recent}

Último mensaje del cliente:
${inboundText || "(sin texto; inicia con un saludo breve y pide el dato más útil)"}`;

    return {
      providers: ctx.aiAgentProviders,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ] as AssistantMessage[],
    };
  }

  private parseAction(text: string): AiControlAction {
    const raw = text?.trim() ?? "";
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match?.[0] ?? raw);
      const replyText = String(parsed.reply_text ?? parsed.text ?? parsed.message ?? parsed.response ?? "").slice(0, 4000);
      // If JSON parsed but reply_text empty, fall through to plain-text extraction
      if (replyText) {
        return {
          reply_text: replyText,
          interactive: parsed.interactive ?? null,
          memory_updates: parsed.memory_updates ?? null,
          handoff_reason: parsed.handoff_reason ?? null,
        };
      }
    } catch {
      // not JSON — fall through
    }
    // Use raw text (model didn't follow JSON format)
    return { reply_text: raw.slice(0, 4000), interactive: null, memory_updates: null, handoff_reason: null };
  }

  private normalizeInteractive(value: unknown, conv: ConversationShape): SupportedInteractive | null {
    if (conv.channel?.type !== "WHATSAPP" || !value || typeof value !== "object") return null;
    const raw = value as Record<string, any>;
    if (raw.type === "button" && Array.isArray(raw.buttons)) {
      const buttons = raw.buttons
        .map((b: Record<string, any>, index: number) => ({
          id: String(b.id ?? `ai_btn_${index + 1}`).slice(0, 200),
          title: String(b.title ?? "").slice(0, 20),
        }))
        .filter((b: { title: string }) => b.title.length > 0)
        .slice(0, 3);
      if (buttons.length === 0) return null;
      return { type: "button", body: String(raw.body ?? "").slice(0, 1024), footer: raw.footer, buttons };
    }
    if (raw.type === "list" && Array.isArray(raw.sections)) {
      const sections = raw.sections
        .map((section: Record<string, any>) => ({
          title: section.title ? String(section.title).slice(0, 24) : undefined,
          rows: Array.isArray(section.rows)
            ? section.rows
                .map((row: Record<string, any>, index: number) => ({
                  id: String(row.id ?? `ai_row_${index + 1}`).slice(0, 200),
                  title: String(row.title ?? "").slice(0, 24),
                  description: row.description ? String(row.description).slice(0, 72) : undefined,
                }))
                .filter((row: { title: string }) => row.title.length > 0)
                .slice(0, 8)
            : [],
        }))
        .filter((section: { rows: unknown[] }) => section.rows.length > 0)
        .slice(0, 2);
      if (sections.length === 0) return null;
      return {
        type: "list",
        body: String(raw.body ?? "").slice(0, 1024),
        buttonText: String(raw.buttonText ?? "Ver opciones").slice(0, 20),
        footer: raw.footer,
        sections,
      };
    }
    if (raw.type === "location_request") {
      return {
        type: "location_request",
        body: String(raw.body ?? "Comparte tu ubicación").slice(0, 1024),
      };
    }
    return null;
  }

  private async createAiMessage(
    workspaceId: string,
    conversationId: string,
    replyText: string,
    interactive: SupportedInteractive | null,
    usage: ChatCompletionWithUsage,
  ) {
    return this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: "OUTBOUND",
        sender_name: "Agente IA",
        sender_ref: "ai-agent@emprende",
        body_text: replyText,
        sent_at: new Date(),
        delivery_status: "PENDING",
        message_type: interactive ? "INTERACTIVE" : "TEXT",
        has_media: false,
        media_status: "NONE",
        button_payload_json: interactive as any,
        interactive_type: interactive?.type ?? null,
        raw_payload_json: {
          ai_control: {
            usage: {
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              total_tokens: usage.total_tokens,
              estimated: usage.estimated,
              provider: usage.provider,
              model: usage.model,
            },
          },
        } as any,
      },
    });
  }

  private async dispatchMessage(
    conv: ConversationShape,
    message: Record<string, any>,
    replyText: string,
    interactive: SupportedInteractive | null,
  ) {
    if (!conv.channel) return this.markSent(message.id, {});
    if (conv.channel.type === "WHATSAPP" && conv.contact?.phone) {
      try {
        const to = conv.contact.phone.replace(/\D/g, "");
        if (!to) return message;
        let externalId: string | null = null;
        if (interactive?.type === "button") {
          externalId = (await this.whatsapp.sendReplyButtons(
            conv.channel,
            to,
            interactive.body || replyText,
            interactive.buttons,
            interactive.footer,
          )).message_id;
        } else if (interactive?.type === "list") {
          externalId = (await this.whatsapp.sendListMessage(
            conv.channel,
            to,
            interactive.body || replyText,
            interactive.buttonText ?? "Ver opciones",
            interactive.sections,
            interactive.footer,
          )).message_id;
        } else if (interactive?.type === "location_request") {
          externalId = (await this.whatsapp.sendLocationRequest(
            conv.channel,
            to,
            interactive.body || replyText,
          )).message_id;
        } else {
          externalId = (await this.whatsapp.sendMessage(conv.channel, to, replyText)).message_id;
        }
        return this.markSent(message.id, {
          provider: "whatsapp",
          provider_message_id: externalId,
          external_message_id: externalId,
        });
      } catch (err) {
        return this.markDispatchFailed(message, err);
      }
    }

    if (conv.channel.type === "TELEGRAM" && conv.contact?.telegram_chat_id) {
      try {
        const result = await this.telegramOutbound.sendMessage(
          conv.channel.id,
          conv.contact.telegram_chat_id,
          replyText,
        );
        const externalId = result?.message_id ? String(result.message_id) : null;
        return this.markSent(message.id, {
          provider: "telegram",
          provider_message_id: externalId,
          telegram_message_id: externalId,
        });
      } catch (err) {
        return this.markDispatchFailed(message, err);
      }
    }

    return this.markSent(message.id, {});
  }

  private async markSent(messageId: string, data: Record<string, any>) {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { ...data, delivery_status: "SENT" },
    });
    this.events.emitMessageStatus({
      message_id: message.id,
      conversation_id: message.conversation_id,
      workspace_id: message.workspace_id,
      delivery_status: "SENT",
      external_message_id: message.external_message_id,
      provider_message_id: message.provider_message_id,
      telegram_message_id: message.telegram_message_id,
    });
    return message;
  }

  private async markDispatchFailed(message: Record<string, any>, err: unknown) {
    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: {
        delivery_status: "DISPATCH_FAILED",
        delivery_error: (err as Error)?.message?.slice(0, 500) ?? "Unknown dispatch error",
      },
    });
    this.events.emitMessageStatus({
      message_id: updated.id,
      conversation_id: updated.conversation_id,
      workspace_id: updated.workspace_id,
      delivery_status: "DISPATCH_FAILED",
      delivery_error: updated.delivery_error,
    });
    return updated;
  }

  private async persistActionMemory(workspaceId: string, conv: ConversationShape, action: AiControlAction) {
    if (!conv.contact?.id || !action.memory_updates) return;
    await this.contactMemory.upsertProfile(workspaceId, conv.contact.id, {
      summary: action.memory_updates.summary,
      common_requests: action.memory_updates.common_requests,
      communication_style: action.memory_updates.communication_style,
      preferences: action.memory_updates.preferences,
      last_interaction_at: new Date().toISOString(),
    });
  }

  private async persistInboundMemory(workspaceId: string, conv: ConversationShape, inboundText: string) {
    if (!conv.contact?.id) return;
    const parsed = parseJsonValue<Record<string, any>>(inboundText, null as any);
    if (!parsed || typeof parsed !== "object") return;
    const lat = parsed.lat ?? parsed.latitude;
    const lng = parsed.lng ?? parsed.longitude;
    if (lat == null || lng == null) return;

    await this.contactMemory.upsertProfile(workspaceId, conv.contact.id, {
      summary: `Cliente compartió ubicación para atención del negocio.`,
      communication_style: "directo",
      preferences: {
        location_lat: String(lat),
        location_lng: String(lng),
        ...(parsed.address ? { address: String(parsed.address) } : {}),
        ...(parsed.name ? { location_name: String(parsed.name) } : {}),
      },
      last_interaction_at: new Date().toISOString(),
    });
  }

  private serializeMessage(msg: Record<string, any>) {
    return {
      id: msg.id,
      workspace_id: msg.workspace_id,
      conversation_id: msg.conversation_id,
      direction: msg.direction,
      sender_name: msg.sender_name,
      sender_ref: msg.sender_ref,
      body_text: msg.body_text,
      sent_at: msg.sent_at?.toISOString?.() ?? msg.sent_at,
      created_at: msg.created_at?.toISOString?.() ?? msg.created_at,
      message_type: msg.message_type,
      delivery_status: msg.delivery_status,
      delivery_error: msg.delivery_error,
      provider: msg.provider,
      provider_message_id: msg.provider_message_id,
      external_message_id: msg.external_message_id,
      telegram_message_id: msg.telegram_message_id,
      has_media: false,
      media_status: "none",
      button_payload_json: msg.button_payload_json,
      interactive_type: msg.interactive_type,
      raw_payload_json: msg.raw_payload_json,
      attachments: [],
    };
  }
}
