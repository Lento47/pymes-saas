import { Injectable, Logger, Inject, forwardRef, Optional } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CloudflareAiService, AssistantMessage } from "./cloudflare-ai.service";
import { AiProviderBalancerService } from "./ai-provider-balancer.service";
import { EmrendeAiService } from "./emprende-ai.service";
import { EventsGateway } from "../gateways/events.gateway";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { TelegramOutboundService } from "../telegram/telegram-outbound.service";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { ContactMemoryService } from "../memory/contact-memory.service";

export type AgentIntent = "ORDER" | "APPOINTMENT" | "QUOTE" | "COMPLAINT";

export interface AgentStep {
  type: string;
  label: string;
  at: string;
}

export interface AgentArtifact {
  type: string;
  id: string;
  title: string;
}

export interface AgentRun {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  intent: AgentIntent;
  started_at: string;
  collected: Record<string, string | null>;
  pending_fields: string[];
  steps: AgentStep[];
  artifact: AgentArtifact | null;
}

export type AgentRunFailReason =
  | "QUOTA_EXCEEDED"
  | "AI_NOT_CONFIGURED"
  | "INTENT_NOT_DETECTED"
  | "CONVERSATION_NOT_FOUND";

export type AgentRunResult =
  | { run: AgentRun; reason: null }
  | { run: null; reason: AgentRunFailReason };

type InteractiveHint = "products_list" | "services_list" | "delivery_buttons";

interface FieldDef {
  key: string;
  question: string | null;
  condition?: { field: string; value: string };
  interactiveHint?: InteractiveHint;
}

/** Payload we build internally before dispatching to WA / Telegram */
type AgentInteractivePayload =
  | { type: "button"; body: string; footer?: string; buttons: Array<{ id: string; title: string }> }
  | { type: "list";   body: string; footer?: string; buttonText: string; sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }> };

interface IntentFlow {
  label: string;
  fields: FieldDef[];
  taskPriority: "LOW" | "MEDIUM" | "HIGH";
}

const INTENT_FLOWS: Record<AgentIntent, IntentFlow> = {
  ORDER: {
    label: "Pedido",
    taskPriority: "MEDIUM",
    fields: [
      // product: try auto-extract first; if null → ask with interactive list
      { key: "product",       question: "¿Qué deseas pedir? 🛒",                                              interactiveHint: "products_list" },
      { key: "delivery_type", question: "¿Entrega a domicilio o pasas a recoger?",                             interactiveHint: "delivery_buttons" },
      { key: "address",       question: "¿Cuál es tu dirección de entrega? 📍",                               condition: { field: "delivery_type", value: "delivery" } },
      { key: "time",          question: "¿A qué hora necesitas el pedido? ⏰" },
    ],
  },
  APPOINTMENT: {
    label: "Cita",
    taskPriority: "MEDIUM",
    fields: [
      // service: try auto-extract first; if null → show services list
      { key: "service", question: "¿Qué servicio necesitas? ✨", interactiveHint: "services_list" },
      { key: "date",    question: "¿Para qué fecha necesitas la cita? 📅" },
      { key: "time",    question: "¿Qué horario te viene mejor? ⏰" },
    ],
  },
  QUOTE: {
    label: "Cotización",
    taskPriority: "LOW",
    fields: [
      // product: try auto-extract first; if null → show products list
      { key: "product",      question: "¿Sobre qué producto o servicio deseas cotizar? 📋", interactiveHint: "products_list" },
      { key: "quantity",     question: "¿Qué cantidad necesitas? 📦" },
      { key: "special_reqs", question: "¿Tienes algún requerimiento especial? (responde 'ninguno' si no) 📝" },
    ],
  },
  COMPLAINT: {
    label: "Reclamo",
    taskPriority: "HIGH",
    fields: [
      // issue: always extracted from the complaint message — never need a list
      { key: "issue",     question: null },
      { key: "order_ref", question: "¿Tienes el número de tu pedido o referencia? (responde 'no' si no tienes) 📋" },
    ],
  },
};

type ConvShape = {
  metadata_json: unknown;
  contact: { id?: string; phone: string | null; telegram_chat_id: string | null } | null;
  channel_id: string | null;
  assigned_user_id?: string | null;
};

@Injectable()
export class AgentRunService {
  private readonly logger = new Logger(AgentRunService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflare: CloudflareAiService,
    @Inject(forwardRef(() => EmrendeAiService))
    private readonly emprendeAi: EmrendeAiService,
    private readonly events: EventsGateway,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp: WhatsAppService,
    private readonly telegramOutbound: TelegramOutboundService,
    private readonly planLimits: PlanLimitsService,
    @Optional() private readonly contactMemory?: ContactMemoryService,
    @Optional() private readonly balancer?: AiProviderBalancerService,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async startRun(
    workspaceId: string,
    conversationId: string,
    triggerText: string,
    knownIntent?: AgentIntent,
  ): Promise<AgentRunResult> {
    const quota = await this.planLimits.evaluatePlanLimit(workspaceId, "agent_executions_per_day");
    if (!quota.allowed) {
      this.logger.warn(`Agent run blocked for workspace ${workspaceId}: ${quota.message}`);
      return { run: null, reason: "QUOTA_EXCEEDED" };
    }

    if (!this.cloudflare.isConfigured && !this.balancer?.isConfigured)
      return { run: null, reason: "AI_NOT_CONFIGURED" };

    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: {
        metadata_json: true,
        contact: { select: { id: true, phone: true, telegram_chat_id: true } },
        channel_id: true,
        assigned_user_id: true,
      },
    });
    if (!conv) return { run: null, reason: "CONVERSATION_NOT_FOUND" };

    const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
    const existingRun = meta.agent_run as AgentRun | undefined;
    if (existingRun?.status === "RUNNING") return { run: existingRun, reason: null };

    const ctx = await this.emprendeAi.buildBusinessContext(workspaceId);

    let intent: AgentIntent;
    let extracted: Record<string, string | null> = {};

    if (knownIntent) {
      // Intent already detected by the conversational LLM — skip redundant detection call
      intent = knownIntent;
    } else {
      // Load contact memory to personalize the agent's context
      const contactMemoryProfile = conv.contact?.id && this.contactMemory
        ? await this.contactMemory.getActiveProfile(conv.contact.id).catch(() => null)
        : null;

      const providers = ctx.aiAgentProviders;
      const detection = await this.detectIntent(
        triggerText,
        ctx.workspaceName,
        ctx.categories,
        providers,
        contactMemoryProfile,
      );
      if (!detection) return { run: null, reason: "INTENT_NOT_DETECTED" };
      intent = detection.intent;
      extracted = detection.extracted;
    }

    const flow = INTENT_FLOWS[intent];

    const collected: Record<string, string | null> = {};
    for (const f of flow.fields) collected[f.key] = null;
    for (const [key, val] of Object.entries(extracted)) {
      if (key in collected && val) collected[key] = String(val);
    }

    const pendingFields = this.computePending(intent, collected);

    const mainValue = extracted.product ?? extracted.service ?? extracted.issue ?? "";
    const run: AgentRun = {
      id: `agr_${Date.now()}`,
      status: "RUNNING",
      intent,
      started_at: new Date().toISOString(),
      collected,
      pending_fields: pendingFields,
      steps: [{
        type: "INTENT_DETECTED",
        label: `Detectó: ${flow.label}${mainValue ? ` — "${mainValue}"` : ""}`,
        at: new Date().toISOString(),
      }],
      artifact: null,
    };

    await this.saveRun(conversationId, meta, run);

    if (pendingFields.length > 0) {
      const q = this.getQuestion(intent, pendingFields[0]) ?? pendingFields[0];
      const hint = this.getInteractiveHint(intent, pendingFields[0]);
      const interactive = hint
        ? this.buildInteractiveForField(pendingFields[0], hint, ctx.productsServices, intent)
        : null;
      await this.sendAgentMessage(workspaceId, conversationId, conv, q, interactive ?? undefined);
      run.steps.push({ type: "QUESTION_SENT", label: q, at: new Date().toISOString() });
      await this.saveRun(conversationId, meta, run);
    } else {
      await this.finalize(workspaceId, conversationId, conv, meta, run);
    }

    this.events.emitAgentUpdated(conversationId, workspaceId, run);
    return { run, reason: null };
  }

  /**
   * Process an inbound message for an active agent run.
   * Returns true if the message was consumed by the agent (skip normal auto-reply).
   */
  async processMessage(workspaceId: string, conversationId: string, inboundText: string): Promise<boolean> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: {
        metadata_json: true,
        contact: { select: { id: true, phone: true, telegram_chat_id: true } },
        channel_id: true,
        assigned_user_id: true,
      },
    });
    if (!conv) return false;

    const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
    const run = meta.agent_run as AgentRun | undefined;
    if (!run || run.status !== "RUNNING") return false;
    const providers = await this.getAgentProviders(workspaceId);

    const currentField = run.pending_fields[0];
    if (!currentField) {
      await this.finalize(workspaceId, conversationId, conv, meta, run);
      this.events.emitAgentUpdated(conversationId, workspaceId, run);
      return true;
    }

    const q = this.getQuestion(run.intent, currentField);
    const value = await this.extractFieldValue(
      currentField,
      q ?? currentField,
      inboundText,
      providers,
    );
    run.collected[currentField] = value ?? inboundText.trim().slice(0, 200);
    run.steps.push({
      type: "FIELD_COLLECTED",
      label: `${this.fieldLabel(currentField)}: ${run.collected[currentField]}`,
      at: new Date().toISOString(),
    });

    run.pending_fields = this.computePending(run.intent, run.collected);
    await this.saveRun(conversationId, meta, run);

    if (run.pending_fields.length === 0) {
      await this.finalize(workspaceId, conversationId, conv, meta, run);
    } else {
      const nextField = run.pending_fields[0];
      const nextQ = this.getQuestion(run.intent, nextField) ?? nextField;
      const hint = this.getInteractiveHint(run.intent, nextField);
      const productsServices = hint ? await this.loadProductsServices(workspaceId) : null;
      const interactive = hint
        ? this.buildInteractiveForField(nextField, hint, productsServices, run.intent)
        : null;
      await this.sendAgentMessage(workspaceId, conversationId, conv, nextQ, interactive ?? undefined);
      run.steps.push({ type: "QUESTION_SENT", label: nextQ, at: new Date().toISOString() });
      await this.saveRun(conversationId, meta, run);
    }

    this.events.emitAgentUpdated(conversationId, workspaceId, run);
    return true;
  }

  async cancelRun(workspaceId: string, conversationId: string): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: { metadata_json: true },
    });
    if (!conv) return;

    const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
    const run = meta.agent_run as AgentRun | undefined;
    if (!run) return;

    run.status = "CANCELLED";
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata_json: { ...meta, agent_run: run } as any, updated_at: new Date() },
      select: { id: true },
    });
    this.events.emitAgentUpdated(conversationId, workspaceId, null);
  }

  getRunFromMeta(conv: { metadata_json: unknown }): AgentRun | null {
    const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
    return this.normalizeRun(meta.agent_run);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async detectIntent(
    text: string,
    businessName: string,
    categories: string[],
    providers: string[],
    memory?: import("../memory/contact-memory.service").ContactMemoryProfile | null,
  ): Promise<{ intent: AgentIntent; extracted: Record<string, string> } | null> {
    if (!this.cloudflare.isConfigured && !this.balancer?.isConfigured) return null;

    const businessType = categories.length > 0 ? categories.join(", ") : "servicios generales";
    const memoryContext = memory
      ? `\nContexto del cliente: suele pedir "${(memory.common_requests ?? []).slice(-3).join(", ")}". Último pedido: ${memory.last_intent ?? "desconocido"}. Preferencias: ${JSON.stringify(memory.preferences ?? {})}.`
      : "";

    const prompt = `Eres el asistente de "${businessName}" (${businessType}).${memoryContext}
Un cliente envió este mensaje: "${text.slice(0, 500)}"

Analiza la intención real de la frase por su sintaxis y semántica. No uses palabras clave hardcodeadas.
Responde SOLO con JSON válido:
{ "intent": "ORDER" | "APPOINTMENT" | "QUOTE" | "COMPLAINT" | null, "extracted": {} }

Reglas:
- ORDER: cliente quiere adquirir/recibir un producto o servicio concreto. Extrae "product" si lo menciona.
- APPOINTMENT: cliente quiere reservar tiempo/atención (cita, turno, reunión). Extrae "service" si lo menciona.
- QUOTE: cliente pregunta por precio o costo sin compromiso inmediato. Extrae "product" si lo menciona.
- COMPLAINT: cliente reporta un problema o insatisfacción. Extrae "issue" con descripción breve del problema.
- null: saludo genérico, pregunta informativa simple, o no aplica ningún flujo.`;

    try {
      const response = this.balancer
        ? await this.balancer.chatCompletion(
            [{ role: "user", content: prompt }] as AssistantMessage[],
            providers,
          )
        : await this.cloudflare.chatCompletion(
            [{ role: "user", content: prompt }] as AssistantMessage[],
            { model: providers[0]?.startsWith("workers-ai/") ? providers[0].slice("workers-ai/".length) : null },
          );
      const match = response.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      if (!parsed.intent || !["ORDER", "APPOINTMENT", "QUOTE", "COMPLAINT"].includes(parsed.intent)) return null;
      return { intent: parsed.intent as AgentIntent, extracted: parsed.extracted ?? {} };
    } catch (err) {
      this.logger.warn("detectIntent failed", err);
      return null;
    }
  }

  private normalizeRun(value: unknown): AgentRun | null {
    if (!value || typeof value !== "object") return null;

    const raw = value as Record<string, unknown>;
    if (typeof raw.id !== "string" || typeof raw.status !== "string") return null;
    if (!["RUNNING", "COMPLETED", "FAILED", "CANCELLED"].includes(raw.status)) return null;
    if (
      typeof raw.intent !== "string" ||
      !["ORDER", "APPOINTMENT", "QUOTE", "COMPLAINT"].includes(raw.intent)
    ) {
      return null;
    }

    const collected =
      raw.collected && typeof raw.collected === "object" && !Array.isArray(raw.collected)
        ? (raw.collected as Record<string, string | null>)
        : {};

    return {
      id: raw.id,
      status: raw.status as AgentRun["status"],
      intent: raw.intent as AgentIntent,
      started_at:
        typeof raw.started_at === "string" ? raw.started_at : new Date(0).toISOString(),
      collected,
      pending_fields: Array.isArray(raw.pending_fields)
        ? raw.pending_fields.filter((field): field is string => typeof field === "string")
        : [],
      steps: Array.isArray(raw.steps)
        ? raw.steps.filter((step): step is AgentStep => {
            if (!step || typeof step !== "object") return false;
            const candidate = step as Record<string, unknown>;
            return (
              typeof candidate.type === "string" &&
              typeof candidate.label === "string" &&
              typeof candidate.at === "string"
            );
          })
        : [],
      artifact:
        raw.artifact && typeof raw.artifact === "object" && !Array.isArray(raw.artifact)
          ? (raw.artifact as AgentArtifact)
          : null,
    };
  }

  private async extractFieldValue(
    field: string,
    question: string,
    answer: string,
    providers: string[],
  ): Promise<string | null> {
    if (!this.cloudflare.isConfigured && !this.balancer) return answer.trim().slice(0, 200);

    const prompt = `Extrae el valor de "${this.fieldLabel(field)}" de esta respuesta.
Pregunta: "${question}"
Respuesta del cliente: "${answer.slice(0, 300)}"

Responde SOLO con el valor extraído en texto plano. Sin explicaciones.
Si es delivery_type, responde exactamente "delivery" o "pickup".
Si indica que no tiene la información, responde "N/A".`;

    try {
      const response = this.balancer
        ? await this.balancer.chatCompletion(
            [{ role: "user", content: prompt }] as AssistantMessage[],
            providers,
          )
        : await this.cloudflare.chatCompletion(
            [{ role: "user", content: prompt }] as AssistantMessage[],
            { model: providers[0]?.startsWith("workers-ai/") ? providers[0].slice("workers-ai/".length) : null },
          );
      return response.trim().slice(0, 200) || null;
    } catch {
      return answer.trim().slice(0, 200);
    }
  }

  private async sendAgentMessage(
    workspaceId: string,
    conversationId: string,
    conv: ConvShape,
    text: string,
    interactive?: AgentInteractivePayload,
  ): Promise<void> {
    const msg = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: "OUTBOUND",
        sender_name: "Agente IA",
        sender_ref: "ai-agent@emprende",
        body_text: text,
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

    this.events.emitNewMessage(conversationId, workspaceId, {
      id: msg.id,
      conversation_id: conversationId,
      workspace_id: workspaceId,
      direction: "OUTBOUND",
      sender_name: "Agente IA",
      sender_ref: "ai-agent@emprende",
      body_text: text,
      sent_at: msg.sent_at?.toISOString(),
      created_at: msg.created_at.toISOString(),
      message_type: "TEXT",
      delivery_status: "SENT",
      has_media: false,
      media_status: "none",
    });

    if (!conv.channel_id) return;

    const channel = await this.prisma.channel.findUnique({
      where: { id: conv.channel_id },
      select: { id: true, type: true, config_json: true },
    });

    if (channel?.type === "WHATSAPP" && conv.contact?.phone) {
      const to = conv.contact.phone.replace(/\D/g, "");
      if (!to) return;
      if (interactive) {
        // Try interactive first; fall back to plain text on error
        this.dispatchWhatsAppInteractive(channel as Record<string, any>, to, interactive).catch((err) => {
          this.logger.warn(`[agent] WA interactive failed, falling back to text: ${err.message}`);
          this.whatsapp.sendMessage(channel as Record<string, any>, to, text).catch(() => {});
        });
      } else {
        this.whatsapp.sendMessage(channel as Record<string, any>, to, text).catch((err) =>
          this.logger.error("AgentRun WA dispatch failed", err),
        );
      }
    }

    if (channel?.type === "TELEGRAM" && conv.contact?.telegram_chat_id) {
      if (interactive) {
        this.dispatchTelegramInteractive(channel.id, conv.contact.telegram_chat_id, interactive).catch((err) => {
          this.logger.warn(`[agent] TG interactive failed, falling back to text: ${err.message}`);
          this.telegramOutbound.sendMessage(channel.id, conv.contact.telegram_chat_id!, text).catch(() => {});
        });
      } else {
        this.telegramOutbound
          .sendMessage(channel.id, conv.contact.telegram_chat_id, text)
          .catch((err) => this.logger.error("AgentRun Telegram dispatch failed", err));
      }
    }
  }

  /** Dispatch an interactive payload via WhatsApp (buttons or list) */
  private async dispatchWhatsAppInteractive(
    channel: Record<string, any>,
    to: string,
    interactive: AgentInteractivePayload,
  ): Promise<void> {
    if (interactive.type === "button") {
      await this.whatsapp.sendReplyButtons(channel, to, interactive.body, interactive.buttons, interactive.footer);
    } else {
      await this.whatsapp.sendListMessage(channel, to, interactive.body, interactive.buttonText, interactive.sections, interactive.footer);
    }
  }

  /** Dispatch an interactive payload via Telegram inline keyboard */
  private async dispatchTelegramInteractive(
    channelId: string,
    chatId: string,
    interactive: AgentInteractivePayload,
  ): Promise<void> {
    if (interactive.type === "button") {
      await this.telegramOutbound.sendWithInlineKeyboard(channelId, chatId, interactive.body, interactive.buttons);
    } else {
      const rows = interactive.sections.flatMap((s) => s.rows);
      await this.telegramOutbound.sendListAsKeyboard(channelId, chatId, interactive.body, rows);
    }
  }

  /** Parse the free-text products/services field into list rows (max 8) */
  private parseProductRows(
    text: string,
    prefix: string,
  ): Array<{ id: string; title: string; description?: string }> {
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
      .filter((l) => l.length > 1 && l.length < 120);

    // Fall back to comma-split if only one line
    const items = lines.length >= 2 ? lines : text.split(/,\s*/).map((l) => l.trim()).filter((l) => l.length > 1);

    return items.slice(0, 8).map((line, i) => {
      // "Name - description" or "Name | description"
      const sepMatch = line.match(/^(.+?)\s*[-–|]\s*(.+)$/);
      // "Name $price" or "Name ₡1,200"
      const priceMatch = line.match(/^(.+?)\s+([\$₡€₽£]\s*[\d,.]+.*)$/);

      if (sepMatch) {
        return { id: `${prefix}_${i}`, title: sepMatch[1].trim().slice(0, 24), description: sepMatch[2].trim().slice(0, 72) };
      }
      if (priceMatch) {
        return { id: `${prefix}_${i}`, title: priceMatch[1].trim().slice(0, 24), description: priceMatch[2].trim().slice(0, 72) };
      }
      return { id: `${prefix}_${i}`, title: line.slice(0, 24) };
    });
  }

  /** Return the interactiveHint for a given field in the given intent */
  private getInteractiveHint(intent: AgentIntent, field: string): InteractiveHint | null {
    return INTENT_FLOWS[intent].fields.find((f) => f.key === field)?.interactiveHint ?? null;
  }

  /** Build the AgentInteractivePayload for a field, or null if not applicable */
  private buildInteractiveForField(
    field: string,
    hint: InteractiveHint,
    productsServices: string | null,
    intent: AgentIntent,
  ): AgentInteractivePayload | null {
    if (hint === "delivery_buttons") {
      return {
        type: "button",
        body: "¿Cómo prefieres recibir tu pedido?",
        buttons: [
          { id: "delivery", title: "🏍️ A domicilio" },
          { id: "pickup",   title: "🏪 Recoger en local" },
        ],
      };
    }

    if (!productsServices?.trim()) return null;

    const prefix = hint === "products_list" ? "prod" : "svc";
    const rows = this.parseProductRows(productsServices, prefix);
    if (rows.length === 0) return null;

    const body =
      intent === "ORDER"   ? "¿Qué deseas ordenar? 🛒" :
      intent === "QUOTE"   ? "¿Sobre qué te gustaría cotizar? 📋" :
                             "¿Qué servicio necesitas? ✨";

    return {
      type: "list",
      body,
      buttonText: "Ver opciones",
      sections: [{ rows }],
    };
  }

  /** Quick DB query to get productsServices text for a workspace */
  private async loadProductsServices(workspaceId: string): Promise<string | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = (workspace?.settings_json as Record<string, any>) ?? {};
    return typeof settings.ai_business_products_services === "string"
      ? settings.ai_business_products_services.trim() || null
      : null;
  }

  private async finalize(
    workspaceId: string,
    conversationId: string,
    conv: ConvShape,
    meta: Record<string, unknown>,
    run: AgentRun,
  ): Promise<void> {
    const flow = INTENT_FLOWS[run.intent];
    const title = this.buildTaskTitle(run);
    const description = this.buildTaskDescription(run);
    const assignedUserId = await this.resolveTaskAssignee(workspaceId, conv, run.intent);

    const task = await this.prisma.task.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        title,
        description,
        priority: flow.taskPriority,
        status: "TODO",
        source: "AUTOMATION",
        assigned_user_id: assignedUserId,
      },
      select: { id: true, title: true },
    });

    run.artifact = { type: "task", id: task.id, title: task.title };
    run.status = "COMPLETED";
    run.steps.push({ type: "ARTIFACT_CREATED", label: `Creado: ${task.title}`, at: new Date().toISOString() });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata_json: { ...meta, agent_run: run } as any, updated_at: new Date() },
      select: { id: true },
    });

    await this.sendAgentMessage(workspaceId, conversationId, conv, this.buildConfirmation(run));

    // INTERNAL event message visible inline
    const internalMsg = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: "INTERNAL",
        sender_name: "Agente IA",
        sender_ref: "ai-agent@emprende",
        body_text: `✓ ${flow.label} registrado\n${title}`,
        sent_at: new Date(),
        delivery_status: "SENT",
        message_type: "TEXT",
        has_media: false,
        media_status: "NONE",
      },
    });

    this.events.emitNewMessage(conversationId, workspaceId, {
      id: internalMsg.id,
      conversation_id: conversationId,
      direction: "INTERNAL",
      sender_name: "Agente IA",
      body_text: internalMsg.body_text,
      sent_at: internalMsg.sent_at?.toISOString(),
      created_at: internalMsg.created_at.toISOString(),
      message_type: "TEXT",
      has_media: false,
      media_status: "none",
    });

    // Enrich contact memory with data collected during this run
    if (this.contactMemory && conv.contact?.id) {
      this.contactMemory
        .enrichFromAgentRun(workspaceId, conv.contact.id, run.intent, run.collected)
        .catch((err) => this.logger.warn("Failed to enrich contact memory", err));
    }

  }

  private async saveRun(conversationId: string, meta: Record<string, unknown>, run: AgentRun): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata_json: { ...meta, agent_run: run } as any, updated_at: new Date() },
      select: { id: true },
    });
  }

  private async resolveTaskAssignee(
    workspaceId: string,
    conv: ConvShape,
    intent: AgentIntent,
  ): Promise<string | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings =
      workspace?.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, any>)
        : {};

    const intentAssignees =
      settings.ai_agent_intent_assignees &&
      typeof settings.ai_agent_intent_assignees === "object" &&
      !Array.isArray(settings.ai_agent_intent_assignees)
        ? (settings.ai_agent_intent_assignees as Record<string, unknown>)
        : {};

    const mode =
      typeof settings.ai_agent_assignment_mode === "string"
        ? settings.ai_agent_assignment_mode
        : "conversation_assignee";

    const candidates = [
      typeof intentAssignees[intent] === "string" ? (intentAssignees[intent] as string) : null,
      mode === "conversation_assignee" ? conv.assigned_user_id ?? null : null,
      mode === "default_user" && typeof settings.ai_agent_default_assignee_id === "string"
        ? settings.ai_agent_default_assignee_id
        : null,
    ].filter((id): id is string => !!id);

    for (const userId of candidates) {
      const member = await this.prisma.workspaceMember.findFirst({
        where: { workspace_id: workspaceId, user_id: userId },
        select: { user_id: true },
      });
      if (member) return member.user_id;
    }

    return null;
  }

  private async getAgentProviders(workspaceId: string): Promise<string[]> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings =
      workspace?.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, any>)
        : {};

    // New format: explicit ordered list — only workers-ai models are currently supported
    const explicit = settings.ai_agent_providers;
    if (Array.isArray(explicit) && explicit.length > 0) {
      const valid = (explicit as unknown[]).filter(
        (s): s is string =>
          typeof s === "string" &&
          s.trim().length > 0 &&
          (s.startsWith("workers-ai/") || s.startsWith("deepseek/")),
      );
      if (valid.length > 0) return valid;
      return ["workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"];
    }

    // Legacy: single provider + model
    if (settings.ai_agent_provider && settings.ai_agent_provider !== "workers_ai") return [];
    if (typeof settings.ai_agent_model !== "string") return [];

    const model = settings.ai_agent_model.trim();
    if (!model || !model.startsWith("@cf/") || /\s/.test(model)) return [];
    return [`workers-ai/${model.slice(0, 160)}`];
  }

  private computePending(intent: AgentIntent, collected: Record<string, string | null>): string[] {
    return INTENT_FLOWS[intent].fields
      .filter((f) => {
        // question===null AND no interactiveHint → purely auto-extracted (COMPLAINT.issue), never ask
        if (f.question === null && !f.interactiveHint) return false;
        // question===null WITH interactiveHint → ask only if NOT already collected
        if (f.condition) {
          const val = collected[f.condition.field] ?? "";
          if (!val.toLowerCase().includes(f.condition.value)) return false;
        }
        return !collected[f.key];
      })
      .map((f) => f.key);
  }

  private getQuestion(intent: AgentIntent, field: string): string | null {
    const f = INTENT_FLOWS[intent].fields.find((fd) => fd.key === field);
    if (!f) return null;
    // Return the question text (may be null for complaint.issue which is auto-extract only)
    return f.question;
  }

  private fieldLabel(field: string): string {
    const MAP: Record<string, string> = {
      product: "Producto", service: "Servicio", delivery_type: "Tipo de entrega",
      address: "Dirección", time: "Horario", date: "Fecha",
      quantity: "Cantidad", special_reqs: "Requerimientos", issue: "Problema", order_ref: "Referencia",
    };
    return MAP[field] ?? field;
  }

  private buildTaskTitle(run: AgentRun): string {
    const c = run.collected;
    switch (run.intent) {
      case "ORDER": {
        const pickup = !c.delivery_type || c.delivery_type.toLowerCase().includes("pickup") || c.delivery_type.toLowerCase().includes("recog");
        return `Pedido: ${c.product ?? "?"} ${pickup ? "(Recojo)" : "(Entrega)"}`;
      }
      case "APPOINTMENT":
        return `Cita: ${c.service ?? "servicio"} — ${c.date ?? "??"} ${c.time ?? "??"}`.trim();
      case "QUOTE":
        return `Cotización: ${c.product ?? "?"} × ${c.quantity ?? "?"}`;
      case "COMPLAINT":
        return `Reclamo: ${(c.issue ?? "").slice(0, 70)}`;
    }
  }

  private buildTaskDescription(run: AgentRun): string {
    const flow = INTENT_FLOWS[run.intent];
    const lines = [`Creado por Agente IA — ${flow.label}`, ""];
    for (const [key, val] of Object.entries(run.collected)) {
      if (val && val !== "N/A") lines.push(`• ${this.fieldLabel(key)}: ${val}`);
    }
    return lines.join("\n");
  }

  private buildConfirmation(run: AgentRun): string {
    const c = run.collected;
    switch (run.intent) {
      case "ORDER": {
        const isDelivery = c.delivery_type?.toLowerCase().includes("delivery") || c.delivery_type?.toLowerCase().includes("dom");
        return `¡Perfecto! 🎉 Pedido de "${c.product}" registrado.\n${isDelivery ? `📍 Entrega a: ${c.address ?? "?"}\n` : "🏪 Retiro en local\n"}⏰ Hora: ${c.time ?? "a confirmar"}\n\nUn agente te confirma los detalles pronto.`;
      }
      case "APPOINTMENT":
        return `¡Cita agendada! 📅\n${c.service ? `🩺 ${c.service}\n` : ""}📅 ${c.date ?? "?"} a las ${c.time ?? "?"}\n\nTe confirmamos disponibilidad pronto.`;
      case "QUOTE":
        return `¡Listo! 📋 Solicitud de cotización para "${c.product}" × ${c.quantity ?? "?"} registrada.\n\nUn agente te envía el precio a la brevedad.`;
      case "COMPLAINT":
        return `Entendemos tu inconveniente 😔 Tu reclamo fue registrado con prioridad alta.\n\nUn agente lo atenderá a la brevedad. Disculpa los inconvenientes.`;
    }
  }
}
