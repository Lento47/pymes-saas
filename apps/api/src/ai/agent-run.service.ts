import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CloudflareAiService, AssistantMessage } from "./cloudflare-ai.service";
import { EmrendeAiService } from "./emprende-ai.service";
import { EventsGateway } from "../gateways/events.gateway";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { TelegramOutboundService } from "../telegram/telegram-outbound.service";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";

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

interface FieldDef {
  key: string;
  question: string | null;
  condition?: { field: string; value: string };
}

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
      { key: "product", question: null },
      { key: "delivery_type", question: "¿Prefiere entrega a domicilio 🏍️ o pasa a recoger en local? 🏪" },
      { key: "address", question: "¿Cuál es su dirección de entrega? 📍", condition: { field: "delivery_type", value: "delivery" } },
      { key: "time", question: "¿A qué hora necesita el pedido? ⏰" },
    ],
  },
  APPOINTMENT: {
    label: "Cita",
    taskPriority: "MEDIUM",
    fields: [
      { key: "service", question: null },
      { key: "date", question: "¿Para qué fecha necesita la cita? 📅" },
      { key: "time", question: "¿Qué horario le viene mejor? ⏰" },
    ],
  },
  QUOTE: {
    label: "Cotización",
    taskPriority: "LOW",
    fields: [
      { key: "product", question: null },
      { key: "quantity", question: "¿Qué cantidad necesita? 📦" },
      { key: "special_reqs", question: "¿Tiene algún requerimiento especial? (responda 'ninguno' si no tiene) 📝" },
    ],
  },
  COMPLAINT: {
    label: "Reclamo",
    taskPriority: "HIGH",
    fields: [
      { key: "issue", question: null },
      { key: "order_ref", question: "¿Tiene el número de su pedido o referencia? (responda 'no' si no tiene) 📋" },
    ],
  },
};

type ConvShape = {
  metadata_json: unknown;
  contact: { phone: string | null; telegram_chat_id: string | null } | null;
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
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async startRun(workspaceId: string, conversationId: string, triggerText: string): Promise<AgentRun | null> {
    const quota = await this.planLimits.evaluatePlanLimit(workspaceId, "agent_executions_per_day");
    if (!quota.allowed) {
      this.logger.warn(`Agent run blocked for workspace ${workspaceId}: ${quota.message}`);
      return null;
    }

    if (!this.cloudflare.isConfigured) return null;

    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: {
        metadata_json: true,
        contact: { select: { phone: true, telegram_chat_id: true } },
        channel_id: true,
        assigned_user_id: true,
      },
    });
    if (!conv) return null;

    const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
    const existingRun = meta.agent_run as AgentRun | undefined;
    if (existingRun?.status === "RUNNING") return existingRun;

    const ctx = await this.emprendeAi.buildBusinessContext(workspaceId);
    const detection = await this.detectIntent(
      triggerText,
      ctx.workspaceName,
      ctx.categories,
      ctx.aiAgentProvider === "workers_ai" ? ctx.aiAgentModel : null,
    );
    if (!detection) return null;

    const { intent, extracted } = detection;
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
      const q = this.getQuestion(intent, pendingFields[0]);
      if (q) {
        await this.sendAgentMessage(workspaceId, conversationId, conv, q);
        run.steps.push({ type: "QUESTION_SENT", label: q, at: new Date().toISOString() });
        await this.saveRun(conversationId, meta, run);
      }
    } else {
      await this.finalize(workspaceId, conversationId, conv, meta, run);
    }

    this.events.emitAgentUpdated(conversationId, workspaceId, run);
    return run;
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
        contact: { select: { phone: true, telegram_chat_id: true } },
        channel_id: true,
        assigned_user_id: true,
      },
    });
    if (!conv) return false;

    const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
    const run = meta.agent_run as AgentRun | undefined;
    if (!run || run.status !== "RUNNING") return false;
    const agentModel = await this.getAgentModel(workspaceId);

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
      agentModel,
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
      const nextQ = this.getQuestion(run.intent, run.pending_fields[0]);
      if (nextQ) {
        await this.sendAgentMessage(workspaceId, conversationId, conv, nextQ);
        run.steps.push({ type: "QUESTION_SENT", label: nextQ, at: new Date().toISOString() });
        await this.saveRun(conversationId, meta, run);
      }
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
    agentModel: string | null,
  ): Promise<{ intent: AgentIntent; extracted: Record<string, string> } | null> {
    if (!this.cloudflare.isConfigured) return null;

    const businessType = categories.length > 0 ? categories.join(", ") : "servicios generales";
    const prompt = `Eres el asistente de "${businessName}" (${businessType}).
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
      const response = await this.cloudflare.chatCompletion(
        [{ role: "user", content: prompt }] as AssistantMessage[],
        { model: agentModel },
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
    agentModel: string | null,
  ): Promise<string | null> {
    if (!this.cloudflare.isConfigured) return answer.trim().slice(0, 200);

    const prompt = `Extrae el valor de "${this.fieldLabel(field)}" de esta respuesta.
Pregunta: "${question}"
Respuesta del cliente: "${answer.slice(0, 300)}"

Responde SOLO con el valor extraído en texto plano. Sin explicaciones.
Si es delivery_type, responde exactamente "delivery" o "pickup".
Si indica que no tiene la información, responde "N/A".`;

    try {
      const response = await this.cloudflare.chatCompletion(
        [{ role: "user", content: prompt }] as AssistantMessage[],
        { model: agentModel },
      );
      return response.trim().slice(0, 200) || null;
    } catch {
      return answer.trim().slice(0, 200);
    }
  }

  private async sendAgentMessage(workspaceId: string, conversationId: string, conv: ConvShape, text: string): Promise<void> {
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

    if (conv.channel_id) {
      const channel = await this.prisma.channel.findUnique({
        where: { id: conv.channel_id },
        select: { id: true, type: true, config_json: true },
      });
      if (channel?.type === "WHATSAPP" && conv.contact?.phone) {
        const to = conv.contact.phone.replace(/\D/g, "");
        if (!to) return;
        this.whatsapp.sendMessage(channel as Record<string, any>, to, text).catch((err) =>
          this.logger.error("AgentRun WA dispatch failed", err),
        );
      }
      if (channel?.type === "TELEGRAM" && conv.contact?.telegram_chat_id) {
        this.telegramOutbound
          .sendMessage(channel.id, conv.contact.telegram_chat_id, text)
          .catch((err) => this.logger.error("AgentRun Telegram dispatch failed", err));
      }
    }
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

  private async getAgentModel(workspaceId: string): Promise<string | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings =
      workspace?.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, any>)
        : {};

    if (settings.ai_agent_provider && settings.ai_agent_provider !== "workers_ai") return null;
    if (typeof settings.ai_agent_model !== "string") return null;

    const model = settings.ai_agent_model.trim();
    if (!model || !model.startsWith("@cf/") || /\s/.test(model)) return null;
    return model.slice(0, 160);
  }

  private computePending(intent: AgentIntent, collected: Record<string, string | null>): string[] {
    return INTENT_FLOWS[intent].fields
      .filter((f) => {
        if (f.question === null) return false; // auto-extracted, already filled or skipped
        if (f.condition) {
          const val = collected[f.condition.field] ?? "";
          if (!val.toLowerCase().includes(f.condition.value)) return false;
        }
        return !collected[f.key];
      })
      .map((f) => f.key);
  }

  private getQuestion(intent: AgentIntent, field: string): string | null {
    return INTENT_FLOWS[intent].fields.find((f) => f.key === field)?.question ?? null;
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
