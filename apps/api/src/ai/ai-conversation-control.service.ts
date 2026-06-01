import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { HaciendaStatus, InvoiceDocumentType, InvoiceIssuanceMode, InvoiceStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { StorageService } from "../common/storage/storage.service";
import { CloudflareAiService, AssistantMessage, ChatCompletionWithUsage } from "./cloudflare-ai.service";
import { AiProviderBalancerService } from "./ai-provider-balancer.service";
import { AiGatewayService } from "./ai-gateway.service";
import { EmrendeAiService } from "./emprende-ai.service";
import { AgentRunService, AgentIntent } from "./agent-run.service";
import { EventsGateway } from "../gateways/events.gateway";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { TelegramOutboundService } from "../telegram/telegram-outbound.service";
import { TelegramService } from "../telegram/telegram.service";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { ContactMemoryService } from "../memory/contact-memory.service";
import { AiTokenMeteringService, AiTokenBalanceSnapshot } from "../ai-tokens/ai-token-metering.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { parseJsonValue } from "../common/prisma/json";
import { generateWorkspaceInvoicePdf } from "../invoices/invoice-pdf.service";
import { ElevenLabsService } from "./elevenlabs.service";
import { AgentRuntimeService } from "../agents/runtime/agent-runtime.service";

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

interface InvoiceActionLine {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
}

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
  invoice_action?: {
    lines: InvoiceActionLine[];
    currency?: string;
    due_days?: number;
    notes?: string;
  } | null;
  intent_detected?: AgentIntent | null;
  delegate_to_agent?: { instance_id: string; reason: string } | null;
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


interface BusinessContextForPlaybook {
  categories: string[];
  needs: string[];
  tone: string | null;
}

interface ReplyOptions {
  /** Set ai_state to AI_ACTIVE permanently after replying (delegation) */
  activate?: boolean;
  /** Bypass the ai_state check — reply even if not AI_ACTIVE (one-shot) */
  force?: boolean;
  triggerText?: string;
  source?: "manual_start" | "auto_reply";
}

@Injectable()
export class AiConversationControlService {
  private readonly logger = new Logger(AiConversationControlService.name);

  private estimateMaxTokens(inboundText: string): number {
    const len = inboundText.trim().length;
    if (len < 20)  return 150;
    if (len < 80)  return 400;
    if (len < 300) return 800;
    return 1200;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflare: CloudflareAiService,
    private readonly emprendeAi: EmrendeAiService,
    private readonly agentRun: AgentRunService,
    private readonly events: EventsGateway,
    private readonly whatsapp: WhatsAppService,
    private readonly telegramOutbound: TelegramOutboundService,
    private readonly telegramService: TelegramService,
    private readonly planLimits: PlanLimitsService,
    private readonly contactMemory: ContactMemoryService,
    private readonly aiTokens: AiTokenMeteringService,
    private readonly balancer: AiProviderBalancerService,
    private readonly gateway: AiGatewayService,
    private readonly storage: StorageService,
    private readonly crypto: CryptoService,
    private readonly elevenLabs: ElevenLabsService,
    private readonly agentRuntime: AgentRuntimeService,
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

  /** One-shot AI reply — responds once but does NOT change ai_state. */
  async replyOnce(workspaceId: string, conversationId: string) {
    const lastInbound = await this.prisma.message.findFirst({
      where: { workspace_id: workspaceId, conversation_id: conversationId, direction: "INBOUND" },
      orderBy: { sent_at: "desc" },
      select: { body_text: true },
    });

    return this.replyToInbound(workspaceId, conversationId, lastInbound?.body_text ?? "", {
      force: true,
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
          human_handover_at: new Date().toISOString(),
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
    if (!options.activate && !options.force && meta.ai_state !== "AI_ACTIVE") {
      return { ok: false, error: "AI_NOT_ACTIVE", balance: await this.aiTokens.getBalance(workspaceId) };
    }

    if (conv.channel?.type === "WHATSAPP") {
      const lastInbound = await this.prisma.message.findFirst({
        where: { conversation_id: conversationId, direction: "INBOUND", provider_message_id: { not: null } },
        orderBy: { sent_at: "desc" },
        select: { provider_message_id: true },
      });
      if (lastInbound?.provider_message_id) {
        this.whatsapp.markAsRead(conv.channel, lastInbound.provider_message_id, true).catch(() => {});
      }
    }

    // Typing indicators — keep visible for the full LLM wait time
    const isWhatsApp = conv.channel?.type === "WHATSAPP";
    const isTelegram = conv.channel?.type === "TELEGRAM";
    const waPhone = conv.contact?.phone?.replace(/\D/g, "") ?? null;
    const tgChatId = conv.contact?.telegram_chat_id ?? null;

    if (isTelegram && tgChatId) {
      this.telegramOutbound.sendTyping(conv.channel!.id, tgChatId).catch(() => {});
    }
    if (isWhatsApp && waPhone) {
      this.whatsapp.sendTypingIndicator(conv.channel as any, waPhone, "typing_on").catch(() => {});
    }

    // Typing indicators expire — refresh periodically (Telegram ~5s, WhatsApp ~25s)
    let typingInterval: ReturnType<typeof setInterval> | null = null;
    if (isTelegram && tgChatId) {
      typingInterval = setInterval(() => {
        this.telegramOutbound.sendTyping(conv.channel!.id, tgChatId).catch(() => {});
      }, 4000);
    } else if (isWhatsApp && waPhone) {
      typingInterval = setInterval(() => {
        this.whatsapp.sendTypingIndicator(conv.channel as any, waPhone, "typing_on").catch(() => {});
      }, 8000);
    }

    await this.persistInboundMemory(workspaceId, conv, inboundText);

    const maxTokens = this.estimateMaxTokens(inboundText);
    const context = await this.buildPrompt(workspaceId, conv, inboundText);
    const reservation = await this.aiTokens.reserveTokens(
      workspaceId,
      this.aiTokens.estimateMessagesTokens(context.messages, maxTokens),
      {
        conversationId,
        description: "Reserva Agente IA conversacional",
        metadata: { source: options.source ?? "auto_reply" },
      },
    );

    if (!reservation.success || !reservation.reservationId) {
      if (typingInterval) clearInterval(typingInterval);
      if (isWhatsApp && waPhone) {
        this.whatsapp.sendTypingIndicator(conv.channel as any, waPhone, "typing_off").catch(() => {});
      }
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
        maxTokens,
        temperature: 0.2,
      });
    } catch (err) {
      if (typingInterval) clearInterval(typingInterval);
      if (isWhatsApp && waPhone) {
        this.whatsapp.sendTypingIndicator(conv.channel as any, waPhone, "typing_off").catch(() => {});
      }
      await this.aiTokens.releaseReservation(workspaceId, reservation.reservationId);
      this.logger.warn(`AI control provider failed: ${(err as Error).message}`);
      return {
        ok: false,
        error: "AI_PROVIDER_FAILED",
        balance: await this.aiTokens.getBalance(workspaceId),
      };
    } finally {
      if (typingInterval) clearInterval(typingInterval);
      if (isWhatsApp && waPhone) {
        this.whatsapp.sendTypingIndicator(conv.channel as any, waPhone, "typing_off").catch(() => {});
      }
    }

    const action = this.parseAction(completion.text);

    // LLM-as-orchestrator: delegate to a Flowise agent instance
    if (action.delegate_to_agent?.instance_id) {
      const balance = await this.aiTokens.consumeReservation(workspaceId, reservation.reservationId, completion, {
        conversationId,
        description: "LLM orquestador → delegación a agente Flowise",
        metadata: { source: options.source ?? "auto_reply" },
      });
      this.events.emitTokenBalanceUpdated(workspaceId, balance);

      // Send interim / placeholder message
      const interimText = action.reply_text?.trim() || "⏳ Un momento, consultando nuestro especialista…";
      const interimMsg = await this.createAiMessage(workspaceId, conversationId, interimText, null, completion);
      const interimDispatched = await this.dispatchMessage(conv, interimMsg, interimText, null);
      const interimFinal = interimDispatched ?? interimMsg;
      this.events.emitNewMessage(conversationId, workspaceId, this.serializeMessage(interimFinal));

      // For Telegram: capture provider_message_id to edit it later
      const tgPlaceholderMsgId: string | null = isTelegram
        ? (interimFinal as any).provider_message_id ?? null
        : null;
      const tgPlaceholderDbId: string | null = isTelegram ? interimFinal.id : null;

      // Keep typing indicator alive during Flowise call
      if (isWhatsApp && waPhone) {
        this.whatsapp.sendTypingIndicator(conv.channel as any, waPhone, "typing_on").catch(() => {});
      }
      let delegateTypingInterval: ReturnType<typeof setInterval> | null = null;
      if (isTelegram && tgChatId) {
        this.telegramOutbound.sendTyping(conv.channel!.id, tgChatId).catch(() => {});
        delegateTypingInterval = setInterval(() => {
          this.telegramOutbound.sendTyping(conv.channel!.id, tgChatId).catch(() => {});
        }, 4000);
      } else if (isWhatsApp && waPhone) {
        delegateTypingInterval = setInterval(() => {
          this.whatsapp.sendTypingIndicator(conv.channel as any, waPhone, "typing_on").catch(() => {});
        }, 8000);
      }

      // Call the Flowise agent
      let agentText: string | null = null;
      try {
        const result = await this.agentRuntime.run({
          agent_instance_id: action.delegate_to_agent.instance_id,
          workspace_id: workspaceId,
          question: inboundText,
          channel: (conv.channel?.type ?? "ALL") as any,
          conversation_id: conversationId,
        });
        agentText = result.text ?? null;
      } catch (err) {
        this.logger.warn(`[delegate_to_agent] Flowise failed (${action.delegate_to_agent.instance_id}): ${(err as Error).message}`);
      } finally {
        if (delegateTypingInterval) clearInterval(delegateTypingInterval);
        if (isWhatsApp && waPhone) {
          this.whatsapp.sendTypingIndicator(conv.channel as any, waPhone, "typing_off").catch(() => {});
        }
      }

      if (agentText?.trim()) {
        let voiceMsgId: string = interimMsg.id;
        if (isTelegram && tgPlaceholderMsgId && conv.channel?.id && tgChatId) {
          // Telegram: edit the placeholder with the final Flowise response
          await this.telegramOutbound.editMessage(conv.channel.id, tgChatId, tgPlaceholderMsgId, agentText);
          if (tgPlaceholderDbId) {
            await this.prisma.message.update({
              where: { id: tgPlaceholderDbId },
              data: { body_text: agentText },
              select: { id: true },
            });
            voiceMsgId = tgPlaceholderDbId;
          }
        } else {
          // WhatsApp and others: send as a new message
          const agentMsg = await this.createAiMessage(workspaceId, conversationId, agentText, null, completion);
          const supportsVoiceAgent = conv.channel?.type === "WHATSAPP" || conv.channel?.type === "TELEGRAM";
          let voiceOnlyAgent = false;
          if (supportsVoiceAgent) {
            const wsRow = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings_json: true } });
            voiceOnlyAgent = ((wsRow?.settings_json as Record<string, any>) ?? {}).ai_voice_enabled === true;
          }
          if (!voiceOnlyAgent) {
            const dispatched = await this.dispatchMessage(conv, agentMsg, agentText, null);
            this.events.emitNewMessage(conversationId, workspaceId, this.serializeMessage(dispatched ?? agentMsg));
          }
          voiceMsgId = agentMsg.id;
        }

        // Voice dispatch for Flowise responses
        const supportsVoice = conv.channel?.type === "WHATSAPP" || conv.channel?.type === "TELEGRAM";
        if (supportsVoice) {
          this.handleVoiceDispatch(workspaceId, conv, agentText, voiceMsgId).catch(
            (err: Error) => this.logger.warn(`[voice] TTS failed (flowise): ${err.message}`),
          );
        }
      }

      const now = new Date().toISOString();
      const nextMeta = options.activate
        ? { ...meta, ai_state: "AI_ACTIVE", last_ai_reply_at: now }
        : { ...meta, last_ai_reply_at: now };
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          last_message_at: new Date(),
          updated_at: new Date(),
          metadata_json: nextMeta as any,
        },
        select: { id: true },
      });

      return { ok: true, balance, ai_state: options.activate ? ("AI_ACTIVE" as const) : undefined };
    }

    if (!action.reply_text.trim()) {
      this.logger.warn(`EMPTY_AI_REPLY provider=${completion.provider} model=${completion.model} raw: "${completion.text?.slice(0, 500)}"`);
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
    this.events.emitTokenBalanceUpdated(workspaceId, balance);

    await this.persistActionMemory(workspaceId, conv, action);

    const supportsVoice = conv.channel?.type === "WHATSAPP" || conv.channel?.type === "TELEGRAM";
    let voiceOnly = false;
    if (supportsVoice && !normalizedInteractive) {
      const wsRow = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings_json: true } });
      voiceOnly = ((wsRow?.settings_json as Record<string, any>) ?? {}).ai_voice_enabled === true;
    }

    if (!voiceOnly) {
      await this.dispatchMessage(conv, message, action.reply_text, normalizedInteractive);
    }

    const supportsInvoice = supportsVoice;
    if (action.invoice_action && conv.contact?.id && supportsInvoice) {
      this.handleInvoiceAction(workspaceId, conv, action.invoice_action).catch((err: Error) =>
        this.logger.warn(`[invoice_action] failed: ${err.message}`),
      );
    }

    if (supportsVoice && !normalizedInteractive) {
      this.handleVoiceDispatch(workspaceId, conv, action.reply_text, message.id).catch(
        (err: Error) => this.logger.warn(`[voice] TTS failed: ${err.message}`),
      );
    }

    const now = new Date().toISOString();
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        last_message_at: new Date(),
        updated_at: new Date(),
        metadata_json: {
          ...meta,
          ai_state: action.handoff_reason ? "HUMAN_ACTIVE" : "AI_ACTIVE",
          ...(action.handoff_reason ? { human_handover_at: new Date().toISOString() } : {}),
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

    const serialized = this.serializeMessage(message);
    this.events.emitNewMessage(conversationId, workspaceId, serialized);

    if (action.intent_detected && !action.handoff_reason) {
      this.agentRun
        .startRun(workspaceId, conversationId, inboundText, action.intent_detected)
        .catch((err: Error) => this.logger.warn(`[auto_agent_run] failed: ${err.message}`));
    }

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
    const channelScopeFilter = (conv.channel?.type ?? "ALL").toUpperCase();
    const [ctx, recentMessages, memory, templates, contextLimit, activeAgents] = await Promise.all([
      this.emprendeAi.buildBusinessContext(workspaceId),
      this.prisma.message.findMany({
        where: { workspace_id: workspaceId, conversation_id: conv.id },
        orderBy: { sent_at: "desc" },
        take: 20, // will be sliced to contextLimit below
        select: { direction: true, body_text: true },
      }),
      conv.contact?.id ? this.contactMemory.getActiveProfile(conv.contact.id).catch(() => null) : null,
      this.prisma.messageTemplate.findMany({
        where: { workspace_id: workspaceId, channel: "WHATSAPP", status: "APPROVED" as any },
        take: 3,
        orderBy: { updated_at: "desc" },
        select: { name: true, external_template_id: true, body: true },
      }),
      this.planLimits.getAiContextMessages(workspaceId),
      this.prisma.agentInstance.findMany({
        where: {
          workspace_id: workspaceId,
          status: "ACTIVE",
          channel_scope: { in: ["ALL", channelScopeFilter as any] },
        },
        select: { id: true, name: true, description: true },
      }).catch(() => [] as Array<{ id: string; name: string; description: string | null }>),
    ]);

    const channelType = conv.channel?.type ?? "UNKNOWN";
    const agentsBlock = activeAgents.length
      ? `\nAGENTES ESPECIALIZADOS DISPONIBLES:\n${activeAgents.map((a) => `- "${a.name}" (instance_id: ${a.id}): ${a.description ?? "agente especializado"}`).join("\n")}\nSi el cliente necesita atención que uno de estos agentes maneje mejor, devuelve delegate_to_agent con el instance_id del agente y un reason breve. En ese caso reply_text puede ser una frase de transición corta o vacío.`
      : "";
    const supportsRichInteractive = channelType === "WHATSAPP" || channelType === "TELEGRAM";
    const recent = recentMessages
      .reverse()
      .slice(-contextLimit)
      .map((m) => `${m.direction === "INBOUND" ? "Cliente" : "Negocio"}: ${m.body_text ?? ""}`)
      .join("\n");
    const templateContext = templates.length
      ? templates.map((t) => `- ${t.name}: ${t.body.slice(0, 180)}`).join("\n")
      : "Sin templates aprobados disponibles.";

    const businessProfileLabel = this.resolveBusinessProfileLabel({
      categories: ctx.categories,
      needs: ctx.needs,
      tone: ctx.tone,
    });
    const playbookSection = this.buildMasterPrompt({
      categories: ctx.categories,
      needs: ctx.needs,
      tone: ctx.tone,
    });

    const system = `⚠️ REGLAS OBLIGATORIAS DE INTERACTIVIDAD — LEE ESTO PRIMERO ⚠️
- SIEMPRE responde con el campo "interactive" cuando el cliente tenga que ELEGIR entre opciones concretas (productos, servicios, métodos de entrega, horarios).
- SIEMPRE usa "interactive": { "type": "location_request", "body": "..." } en WhatsApp cuando necesites la dirección de entrega. NUNCA pidas la dirección como texto plano.
- SIEMPRE usa "interactive": { "type": "button", ... } cuando haya exactamente 2-3 opciones (ej: delivery vs pickup, sí vs no).
- SIEMPRE usa "interactive": { "type": "list", ... } cuando el negocio tenga un catálogo de productos/servicios.
- SIEMPRE detecta "intent_detected" cuando el cliente quiera: hacer un pedido (ORDER), agendar cita (APPOINTMENT), solicitar cotización (QUOTE), o presentar un reclamo (COMPLAINT).
- reply_text DEBE acompañar al interactive con un mensaje corto (1 frase) que introduzca la acción.

${this.emprendeAi.buildSystemPrompt(ctx)}

Perfil inferido del negocio: ${businessProfileLabel}.
${playbookSection}

Toma control conversacional de esta conversación. Responde el primer mensaje aunque sea un saludo.
ORDEN DE PRIORIDAD (de mayor a menor):
1) Seguridad y cumplimiento: no inventar datos, no divulgar información sensible y escalar a humano cuando corresponda.
2) Contrato de salida: responder en JSON estricto y respetar exactamente el esquema solicitado.
3) Políticas del negocio: cumplir businessContext y todas las restricciones del tenant.
4) Objetivo conversacional: avanzar la conversación con el siguiente paso más útil.
5) Estilo y tono: mantener claridad, cercanía y brevedad.
Si hay conflicto entre reglas, sigue la regla de mayor prioridad y explica brevemente la limitación al usuario final sin revelar políticas internas.
Mantén cada reply_text corto y enfocado en UNA sola acción: saluda, o pregunta, o confirma — nunca todo en un mensaje.
Si el cliente saluda o es el primer contacto, responde solo con un saludo cálido y una sola pregunta breve.
Respuestas ideales: 1-3 frases. Evita listas largas o explicaciones extensas salvo que el cliente lo pida explícitamente.
Define el idioma activo de conversación como el último idioma dominante del cliente.
Si el idioma activo no está en los idiomas soportados del negocio, responde en el idioma fallback del negocio (español por defecto) y agrega una sola aclaración inicial; no la repitas en turnos posteriores.
Si el cliente pide explícitamente cambiar de idioma, permite el cambio y persiste esa preferencia usando memory_updates.preferences.language.
No mezcles idiomas en una misma respuesta salvo que el cliente lo pida explícitamente.
Si el canal es WhatsApp o Telegram puedes usar botones o listas cuando ayude. Solo usa location_request en WhatsApp.
Si no sabes algo, no inventes precios, inventario ni disponibilidad.
${agentsBlock}
Responde SOLO JSON válido con este shape:
{
  "reply_text": "texto que se enviará al cliente (puede ser vacío si delegas a un agente)",
  "interactive": null | { "type": "button", "body": "...", "buttons": [{"id":"...", "title":"..."}] } | { "type": "list", "body":"...", "buttonText":"Ver opciones", "sections":[{"title":"...", "rows":[{"id":"...", "title":"...", "description":"..."}]}] } | { "type": "location_request", "body":"..." },
  "memory_updates": null | { "summary": "...", "common_requests": ["..."], "communication_style": "...", "preferences": {"clave":"valor"} },
  "handoff_reason": null,
  "invoice_action": null | { "lines": [{"description":"...", "quantity":1, "unit_price":0.00}], "currency":"USD", "due_days":30, "notes":"..." },
  "intent_detected": null | "ORDER" | "APPOINTMENT" | "QUOTE" | "COMPLAINT",
  "delegate_to_agent": null | { "instance_id": "<id del agente>", "reason": "<por qué delegas>" }
}
Reglas de intent_detected:
- Úsalo SOLO cuando el cliente exprese claramente una intención de acción (hacer un pedido, agendar cita, solicitar cotización, presentar un reclamo).
- Si el mensaje es un saludo, pregunta, consulta informativa o conversación general: intent_detected debe ser null.
- Cuando intent_detected no es null, tu reply_text debe ser un breve reconocimiento (ej: "¡Claro! Con gusto te ayudo con tu pedido." o "Perfecto, agendamos tu cita."). No hagas preguntas de recolección — el sistema estructurado se encarga.
- Cuando intent_detected es null, avanza la conversación y pide la siguiente información útil de forma natural.${ctx.intentPositiveExamples ? `\nEjemplos de mensajes que SÍ deben activar intent_detected:\n${ctx.intentPositiveExamples}` : ""}${ctx.intentNegativeExamples ? `\nEjemplos de mensajes que NO deben activar intent_detected:\n${ctx.intentNegativeExamples}` : ""}
Reglas de interactive:
- Usa interactive solo si el canal lo soporta.
- Botones: máximo 3, títulos cortos.
- Listas: opciones claras, máximo 8 filas.
- Location request: OBLIGATORIO en WhatsApp cuando necesites la dirección de entrega de un pedido, visita a domicilio o servicio presencial. NUNCA pidas la dirección de entrega como texto plano en WhatsApp — usa siempre location_request.
- No incluyas markdown fuera del JSON.
Reglas de invoice_action:
- Solo genera invoice_action cuando el cliente haya CONFIRMADO explícitamente su pedido o servicio.
- Debes conocer la descripción, cantidad y precio exacto de cada ítem; si no los tienes, no uses invoice_action.
- reply_text debe anunciar brevemente que se enviará la factura (ej: "En un momento te envío tu factura.").
- invoice_action aplica en WhatsApp y Telegram; en otros canales usa null.

ESCALACIÓN OBLIGATORIA:
- Debes escalar SIEMPRE (handoff_reason con motivo breve y claro) cuando ocurra cualquiera de estos triggers baseline:
  1) Solicitud legal, médica o financiera sensible que requiera criterio profesional o implique riesgo.
  2) Falta de datos críticos para resolver tras 2 intentos claros de recopilación en la conversación.
  3) Cliente molesto, amenaza de cancelación, o reclamo repetido sin resolución.
  4) Petición fuera del alcance del negocio, políticas o capacidades operativas.
- Triggers dinámicos adicionales configurados por el negocio:
${ctx.escalationConditions ? `  ${ctx.escalationConditions}` : "  (sin condiciones adicionales configuradas)"}
- Respuesta estándar de transición al escalar (mantenerla corta):
  "Te ayudo con esto de inmediato: voy a escalar tu caso con un especialista humano y te responderemos en breve."
- Cuando escales:
  - reply_text: usa la transición estándar (o versión equivalente igual de corta y clara).
  - handoff_reason: obligatorio, string no vacío, específico del trigger (ej: "legal_sensible", "missing_critical_data", "customer_complaint_repeated", "out_of_scope").
  - intent_detected: null, salvo que exista una intención inequívoca y compatible con escalación.
- Cuando NO escales: handoff_reason debe ser null.`;

    const user = `Canal: ${channelType}
Interactivo disponible: ${channelType === "WHATSAPP" ? "sí (botones, listas, location_request)" : supportsRichInteractive ? "sí (botones, listas)" : "no"}
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

  private resolveBusinessProfileLabel(ctx: BusinessContextForPlaybook): string {
    const signal = `${ctx.categories.join(" ")} ${ctx.needs.join(" ")} ${ctx.tone ?? ""}`.toLowerCase();
    const has = (...terms: string[]) => terms.some((term) => signal.includes(term));

    if (has("salud_bienestar", "clin", "medic", "odont", "psico", "terap")) return "salud y bienestar";
    if (has("belleza_cuidado", "spa", "barber", "uñas", "manicure", "estética")) return "belleza y cuidado personal";
    if (has("alimentacion_bebidas", "restaur", "cafeter", "comida", "delivery", "menu")) return "alimentos y bebidas";
    if (has("transporte_logistica", "envío", "mensaj", "logística", "paquete", "flete")) return "transporte y logística";
    if (has("comercio_ventas", "ecommerce", "tienda", "venta", "catálogo", "inventario")) return "comercio y ventas";
    if (has("servicios_profesionales", "asesor", "consult", "legal", "contable", "agencia")) return "servicios profesionales";
    if (has("educacion", "curso", "clase", "academ", "tutor", "capacit")) return "educación";
    if (has("tecnologia", "software", "saas", "soporte técnico", "automatización")) return "tecnología";

    return "negocio general";
  }

  private buildMasterPrompt(ctx: BusinessContextForPlaybook): string {
    const profile = this.resolveBusinessProfileLabel(ctx);
    const objectiveMap: Record<string, string> = {
      "salud y bienestar": "captar pacientes elegibles, agendar citas y orientar alcances sin diagnóstico clínico",
      "belleza y cuidado personal": "cerrar reservas, confirmar disponibilidad y estimular recompra",
      "alimentos y bebidas": "convertir consultas en pedidos completos con dirección/entrega confirmada",
      "transporte y logística": "levantar origen-destino-restricciones para cotizar o programar servicio",
      "comercio y ventas": "calificar necesidad, recomendar producto y llevar a confirmación de compra",
      "servicios profesionales": "entender caso, definir alcance y agendar descubrimiento/cotización",
      "educación": "identificar nivel/interés y mover a inscripción o sesión informativa",
      "tecnología": "levantar problema técnico/objetivo y llevar a demo, trial o propuesta",
      "negocio general": "entender necesidad principal, resolver dudas y escalar a acción concreta",
    };

    return `PLAYBOOK DEL PERFIL
- Perfil detectado: ${profile}.
- Objetivos típicos por vertical: ${objectiveMap[profile] ?? objectiveMap["negocio general"]}.
- Datos mínimos por intención:
  - ORDER: producto/servicio, cantidad, variantes, dirección o modalidad de entrega/retiro, forma de pago.
  - APPOINTMENT: servicio requerido, fecha/hora preferida, nombre y teléfono de contacto, sede/modalidad.
  - QUOTE: qué necesita, alcance/cantidad, presupuesto o rango esperado, plazo requerido.
  - COMPLAINT: resumen del problema, evidencia o referencia de orden/cita, impacto y resultado esperado.
- Riesgos frecuentes:
  - Salud y bienestar: no dar consejo clínico, diagnóstico ni indicaciones médicas personalizadas.
  - Comercio/logística: no prometer stock, tiempos o precios sin confirmación del negocio.
  - General: evitar lenguaje legal/financiero concluyente y escalar cuando haya riesgo o ambigüedad.`;
  }

  private parseAction(text: string): AiControlAction {
    const raw = text?.trim() ?? "";
    const VALID_INTENTS: AgentIntent[] = ["ORDER", "APPOINTMENT", "QUOTE", "COMPLAINT"];
    const fallbackReply = "Disculpa, tuve un problema preparando la respuesta. ¿Me puedes repetir brevemente qué necesitas?";

    const normalize = (parsed: Record<string, any>): AiControlAction => {
      const replyText = String(parsed.reply_text ?? parsed.text ?? parsed.message ?? parsed.response ?? "").slice(0, 4000);
      const intentRaw = parsed.intent_detected as string | null | undefined;
      const intentDetected: AgentIntent | null =
        intentRaw && VALID_INTENTS.includes(intentRaw as AgentIntent) ? (intentRaw as AgentIntent) : null;

      const delegateRaw = parsed.delegate_to_agent;
      const delegateToAgent =
        delegateRaw && typeof delegateRaw === "object" && typeof delegateRaw.instance_id === "string"
          ? { instance_id: delegateRaw.instance_id as string, reason: String(delegateRaw.reason ?? "") }
          : null;

      return {
        reply_text: replyText || (delegateToAgent ? "" : fallbackReply),
        interactive: parsed.interactive ?? null,
        memory_updates: parsed.memory_updates ?? null,
        handoff_reason: parsed.handoff_reason ?? null,
        invoice_action: parsed.invoice_action ?? null,
        intent_detected: intentDetected,
        delegate_to_agent: delegateToAgent,
      };
    };

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match?.[0] ?? raw);
      if (parsed && typeof parsed === "object") return normalize(parsed);
    } catch {
      // malformed JSON — handled below
    }

    const replyMatch = raw.match(/"reply_text"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (replyMatch?.[1]) {
      try {
        return {
          reply_text: JSON.parse(`"${replyMatch[1]}"`).slice(0, 4000),
          interactive: null,
          memory_updates: null,
          handoff_reason: null,
          invoice_action: null,
          intent_detected: null,
        };
      } catch {
        return {
          reply_text: replyMatch[1].slice(0, 4000),
          interactive: null,
          memory_updates: null,
          handoff_reason: null,
          invoice_action: null,
          intent_detected: null,
        };
      }
    }

    if (/^\s*[\{\[]/.test(raw) || raw.includes("\"reply_text\"") || raw.includes("\"interactive\"")) {
      this.logger.warn(`AI_OUTPUT_CONTRACT_FAILED raw=${raw.slice(0, 500)}`);
      return {
        reply_text: fallbackReply,
        interactive: null,
        memory_updates: null,
        handoff_reason: null,
        invoice_action: null,
        intent_detected: null,
      };
    }

    return {
      reply_text: raw.slice(0, 4000) || fallbackReply,
      interactive: null,
      memory_updates: null,
      handoff_reason: null,
      invoice_action: null,
      intent_detected: null,
    };
  }

  private normalizeInteractive(value: unknown, conv: ConversationShape): SupportedInteractive | null {
    const richChannels = new Set(["WHATSAPP", "TELEGRAM"]);
    if (!richChannels.has(conv.channel?.type ?? "") || !value || typeof value !== "object") return null;
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

  private async handleVoiceDispatch(
    workspaceId: string,
    conv: ConversationShape,
    replyText: string,
    outboundMessageId: string,
  ): Promise<void> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const s = (ws?.settings_json as Record<string, any>) ?? {};
    if (s.ai_voice_enabled !== true) return;

    const cleanText = replyText.replace(/[*_`~#>\[\]!]/g, "").trim();
    if (!cleanText) return;

    const apiKeyEnc = s.elevenlabs_api_key_enc as string | undefined;
    const apiKey = apiKeyEnc ? this.crypto.decrypt(apiKeyEnc) : undefined;
    const voiceId = (s.ai_voice_id as string) || undefined;

    // Si el workspace no tiene key/voice propios, verificar que el sistema los tenga
    if (!apiKey && !voiceId && !this.elevenLabs.isConfigured()) {
      const errMsg = "Falta API key y Voice ID de ElevenLabs (ni en workspace ni en sistema)";
      this.logger.warn(`[voice] config incompleta workspace=${workspaceId}: ${errMsg}`);
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { settings_json: { ...s, voice_last_error: errMsg } as any },
        select: { id: true },
      });
      return;
    }

    const mp3Buffer = await this.elevenLabs.textToSpeech(cleanText, apiKey, voiceId);

    if (conv.channel?.type === "WHATSAPP" && conv.contact?.phone) {
      // WhatsApp voice notes require OGG OPUS — convert in memory, never store MP3
      const oggBuffer = await this.convertMp3ToOpusOgg(mp3Buffer);
      const key = `voice/${workspaceId}/${outboundMessageId}.ogg`;
      await this.storage.upload(key, oggBuffer, "audio/ogg");
      const url = await this.storage.getPresignedUrl(key, 1800);
      const to = conv.contact.phone.replace(/\D/g, "");
      await this.whatsapp.sendMedia(conv.channel as any, to, url, "audio", undefined, true);
    } else if (conv.channel?.type === "TELEGRAM" && conv.contact?.telegram_chat_id) {
      // Telegram accepts MP3 directly
      const key = `voice/${workspaceId}/${outboundMessageId}.mp3`;
      await this.storage.upload(key, mp3Buffer, "audio/mpeg");
      const url = await this.storage.getPresignedUrl(key, 1800);
      await this.telegramService.sendVoice(conv.channel.id, conv.contact.telegram_chat_id, url);
    }

    // Clear any previous config error on success
    if (s.voice_last_error) {
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { settings_json: { ...s, voice_last_error: null } as any },
        select: { id: true },
      });
    }

    this.logger.log(`[voice] TTS sent for message=${outboundMessageId} workspace=${workspaceId}`);
  }

  private async handleInvoiceAction(
    workspaceId: string,
    conv: ConversationShape,
    invoiceAction: NonNullable<AiControlAction["invoice_action"]>,
  ): Promise<void> {
    const channelSupported = conv.channel?.type === "WHATSAPP" || conv.channel?.type === "TELEGRAM";
    if (!conv.contact?.id || !channelSupported) return;
    const hasContactAddress = conv.contact.phone || conv.contact.telegram_chat_id;
    if (!hasContactAddress) return;

    const currency = invoiceAction.currency ?? "USD";
    const dueDays = Math.max(1, Math.min(365, invoiceAction.due_days ?? 30));
    const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

    // Compute totals
    const lines = (invoiceAction.lines ?? []).filter(
      (l) => l.description && l.quantity > 0 && l.unit_price >= 0,
    );
    if (lines.length === 0) return;

    const lineData = lines.map((l, idx) => ({
      line_number: idx + 1,
      description: String(l.description).slice(0, 500),
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      subtotal: Number(l.quantity) * Number(l.unit_price),
      total_line_amount: Number(l.quantity) * Number(l.unit_price),
      discount_amount: 0,
      tax_amount: 0,
      workspace_id: workspaceId,
    }));
    const subtotal = lineData.reduce((s, l) => s + l.subtotal, 0);

    // Auto-generate invoice number
    const count = await this.prisma.invoice.count({ where: { workspace_id: workspaceId } });
    const year = new Date().getFullYear();
    const number = `IA-${year}-${String(count + 1).padStart(4, "0")}`;

    // Workspace name
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    // Create invoice in DB
    const invoice = await this.prisma.invoice.create({
      data: {
        workspace_id: workspaceId,
        contact_id: conv.contact.id,
        conversation_id: conv.id,
        number,
        amount: subtotal,
        subtotal,
        currency,
        due_date: dueDate,
        issue_date: new Date(),
        status: InvoiceStatus.SENT,
        document_type: InvoiceDocumentType.FACTURA_ELECTRONICA,
        issuance_mode: InvoiceIssuanceMode.MANUAL_ONLY,
        hacienda_status: HaciendaStatus.DRAFT,
        description: invoiceAction.notes,
        lines: { create: lineData },
      },
      select: { id: true },
    });

    // Generate PDF
    const pdfBuffer = await generateWorkspaceInvoicePdf({
      number,
      status: "ENVIADA",
      workspaceName: ws?.name ?? "Negocio",
      contactName: conv.contact.full_name ?? conv.contact.phone,
      contactPhone: conv.contact.phone,
      currency,
      lines: lineData,
      subtotal,
      total: subtotal,
      issueDate: new Date(),
      dueDate,
      notes: invoiceAction.notes,
    });

    // Upload to storage
    const storageKey = `invoices/${workspaceId}/${invoice.id}.pdf`;
    await this.storage.upload(storageKey, pdfBuffer, "application/pdf");
    const pdfUrl = await this.storage.getPresignedUrl(storageKey, 3600);

    // Send document via channel
    if (conv.channel.type === "WHATSAPP" && conv.contact.phone) {
      const to = conv.contact.phone.replace(/\D/g, "");
      await this.whatsapp.sendMedia(conv.channel as any, to, pdfUrl, "document", `Factura ${number}`);
    } else if (conv.channel.type === "TELEGRAM") {
      const chatId = conv.contact.telegram_chat_id ?? conv.contact.phone ?? "";
      if (chatId) {
        await this.telegramService.sendDocument(conv.channel.id, chatId, pdfUrl, `Factura ${number}`);
      }
    }
    this.logger.log(`[invoice_action] invoice=${invoice.id} number=${number} channel=${conv.channel.type}`);
  }

  private async dispatchMessage(
    conv: ConversationShape,
    message: Record<string, any>,
    replyText: string,
    interactive: SupportedInteractive | null,
  ) {
    if (!conv.channel) return this.markSent(message.id, {});

    let replyToWamid: string | null = null;
    let shouldUseContextualReply = false;
    if (conv.channel.type === "WHATSAPP") {
      const lastInbound = await this.prisma.message.findFirst({
        where: { conversation_id: conv.id, direction: "INBOUND", provider_message_id: { not: null } },
        orderBy: { sent_at: "desc" },
        select: { provider_message_id: true, reply_to_message_id: true },
      });
      replyToWamid = lastInbound?.provider_message_id ?? null;
      shouldUseContextualReply = !!lastInbound?.reply_to_message_id;
    }

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
          externalId = replyToWamid && shouldUseContextualReply
            ? (await this.whatsapp.sendReply(conv.channel, to, replyText, replyToWamid)).message_id
            : (await this.whatsapp.sendMessage(conv.channel, to, replyText)).message_id;
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
        const chatId = conv.contact.telegram_chat_id;
        let externalId: string | null = null;

        if (interactive?.type === "button") {
          externalId = (await this.telegramOutbound.sendWithInlineKeyboard(
            conv.channel.id,
            chatId,
            interactive.body || replyText,
            interactive.buttons,
          )).message_id;
        } else if (interactive?.type === "list") {
          const rows = interactive.sections.flatMap((s) => s.rows);
          externalId = (await this.telegramOutbound.sendListAsKeyboard(
            conv.channel.id,
            chatId,
            interactive.body || replyText,
            rows,
          )).message_id;
        } else {
          const lastInbound = await this.prisma.message.findFirst({
            where: { conversation_id: conv.id, direction: "INBOUND", telegram_message_id: { not: null } },
            orderBy: { sent_at: "desc" },
            select: { telegram_message_id: true },
          });
          externalId = (await this.telegramOutbound.sendReplyText(
            conv.channel.id,
            chatId,
            replyText,
            lastInbound?.telegram_message_id ?? null,
          )).message_id;
        }

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

  /** Convert an MP3 buffer to OGG OPUS using ffmpeg (required for WhatsApp voice notes). */
  private convertMp3ToOpusOgg(mp3Buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const { spawn } = require("child_process");
      const ff = spawn("ffmpeg", [
        "-f", "mp3",
        "-i", "pipe:0",
        "-c:a", "libopus",
        "-b:a", "48000",
        "-ar", "48000",
        "-ac", "1",
        "-f", "ogg",
        "pipe:1",
      ]);
      const chunks: Buffer[] = [];
      ff.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      ff.on("close", (code: number) => {
        if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ff.on("error", (err: Error) => reject(new Error(`ffmpeg spawn failed: ${err.message}`)));
      ff.stderr.resume(); // drain stderr so process doesn't stall
      ff.stdin.write(mp3Buffer);
      ff.stdin.end();
    });
  }
}
