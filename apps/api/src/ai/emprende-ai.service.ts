import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CloudflareAiService, AssistantMessage } from "./cloudflare-ai.service";
import { AiProviderBalancerService } from "./ai-provider-balancer.service";
import { AiGatewayService } from "./ai-gateway.service";
import { parseJsonValue } from "../common/prisma/json";

export interface ContactProfileInsights {
  summary: string;
  common_requests: string[];
  contact_frequency: string;
  communication_style: string;
}

export interface TaskSuggestion {
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

interface BusinessContext {
  workspaceName: string;
  countryCode: string | null;
  plan: string;
  categories: string[];
  teamSize: string | null;
  needs: string[];
  businessPrompt: string | null;
  productsServices: string | null;
  policies: string | null;
  tone: string | null;
  aiAgentProvider: string;
  aiAgentModel: string | null;
  aiAgentProviders: string[];
  recentConversations: { contactName: string; lastMessage: string }[];
  pendingTasks: { title: string; priority: string }[];
}

@Injectable()
export class EmrendeAiService {
  private readonly logger = new Logger(EmrendeAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflare: CloudflareAiService,
    @Optional() private readonly balancer?: AiProviderBalancerService,
    @Optional() private readonly gateway?: AiGatewayService,
  ) {}

  async buildBusinessContext(workspaceId: string): Promise<BusinessContext> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        name: true,
        country_code: true,
        plan: true,
        settings_json: true,
        business_profile: {
          select: { categories: true, team_size: true, needs: true },
        },
      },
    });

    const recentConvs = await this.prisma.conversation.findMany({
      where: { workspace_id: workspaceId, status: { in: ["NEW", "OPEN", "PENDING"] } },
      orderBy: { last_message_at: "desc" },
      take: 5,
      select: {
        contact: { select: { full_name: true } },
        messages: {
          orderBy: { sent_at: "desc" },
          take: 1,
          select: { body_text: true },
        },
      },
    });

    const pendingTasks = await this.prisma.task.findMany({
      where: { workspace_id: workspaceId, status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: { created_at: "desc" },
      take: 5,
      select: { title: true, priority: true },
    });

    const settings = parseJsonValue<Record<string, any>>(workspace.settings_json, {});

    return {
      workspaceName: workspace.name,
      countryCode: workspace.country_code ?? null,
      plan: workspace.plan,
      categories: workspace.business_profile?.categories ?? [],
      teamSize: workspace.business_profile?.team_size ?? null,
      needs: workspace.business_profile?.needs ?? [],
      businessPrompt: this.cleanContextText(settings.ai_business_prompt),
      productsServices: this.cleanContextText(settings.ai_business_products_services),
      policies: this.cleanContextText(settings.ai_business_policies),
      tone: this.cleanContextText(settings.ai_business_tone),
      aiAgentProvider:
        typeof settings.ai_agent_provider === "string"
          ? settings.ai_agent_provider
          : "workers_ai",
      aiAgentModel: this.cleanAgentModel(settings.ai_agent_model),
      aiAgentProviders: this.buildProviderList(settings),
      recentConversations: recentConvs.map((c) => ({
        contactName: c.contact?.full_name ?? "Cliente",
        lastMessage: c.messages[0]?.body_text ?? "",
      })),
      pendingTasks: pendingTasks.map((t) => ({ title: t.title, priority: t.priority })),
    };
  }

  buildSystemPrompt(ctx: BusinessContext): string {
    const businessType = this.describeBusinessType(ctx.categories);
    const country = ctx.countryCode ? ` en ${ctx.countryCode}` : "";

    let contextLines = [
      `Eres el asistente de atención al cliente de "${ctx.workspaceName}"${country}, un negocio de ${businessType}.`,
      `Responde siempre en español, con un tono amigable, directo y profesional, como lo haría un emprendedor latinoamericano.`,
      `Sé conciso. Evita respuestas largas. Si el cliente pregunta por precios, disponibilidad o servicios específicos, responde con lo que sabes del negocio.`,
    ];

    if (ctx.businessPrompt) {
      contextLines.push(`\nContexto configurado por el negocio:\n${ctx.businessPrompt}`);
    }

    if (ctx.productsServices) {
      contextLines.push(`\nProductos o servicios del negocio:\n${ctx.productsServices}`);
    }

    if (ctx.policies) {
      contextLines.push(`\nPolíticas operativas que debes respetar:\n${ctx.policies}`);
    }

    if (ctx.tone) {
      contextLines.push(`\nTono de marca solicitado:\n${ctx.tone}`);
    }

    if (ctx.categories.includes("alimentacion_bebidas")) {
      contextLines.push(
        `El negocio ofrece productos de comida/bebida. Puedes responder consultas sobre pedidos, menú, horarios de entrega e ingredientes.`,
      );
    }
    if (ctx.categories.includes("salud_bienestar")) {
      contextLines.push(
        `El negocio ofrece servicios de salud/bienestar. Puedes responder sobre disponibilidad de citas, servicios ofrecidos y precios.`,
      );
    }
    if (ctx.categories.includes("comercio_ventas")) {
      contextLines.push(
        `El negocio se dedica a ventas/comercio. Puedes responder sobre inventario, cotizaciones y pedidos.`,
      );
    }
    if (ctx.categories.includes("servicios_profesionales")) {
      contextLines.push(
        `El negocio ofrece servicios profesionales. Puedes orientar sobre los servicios, presupuestos y disponibilidad.`,
      );
    }

    if (ctx.pendingTasks.length > 0) {
      const taskList = ctx.pendingTasks.map((t) => `- ${t.title}`).join("\n");
      contextLines.push(`\nTareas pendientes en el negocio:\n${taskList}`);
    }

    contextLines.push(
      `\nSi no tienes información exacta para responder, dile al cliente que un agente le atenderá pronto. No inventes precios ni disponibilidad.`,
    );

    return contextLines.join("\n");
  }

  private cleanContextText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 2000) : null;
  }

  private cleanAgentModel(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || !trimmed.startsWith("@cf/") || /\s/.test(trimmed)) return null;
    return trimmed.slice(0, 160);
  }

  private buildProviderList(settings: Record<string, any>): string[] {
    // New format: explicit ordered list from settings
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
    // Legacy: convert single ai_agent_provider + ai_agent_model
    const isWorkersAi =
      !settings.ai_agent_provider || settings.ai_agent_provider === "workers_ai";
    if (isWorkersAi) {
      const model = this.cleanAgentModel(settings.ai_agent_model);
      if (model) return [`workers-ai/${model}`];
    }
    // Default empty list — gateway uses SYSTEM_AI_MODEL
    return [];
  }

  private async aiChat(
    messages: AssistantMessage[],
    providers: string[],
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    if (this.balancer) {
      return this.balancer.chatCompletion(messages, providers, options);
    }
    // Fallback to cloudflare (for backwards compat)
    const model = providers[0]; // just use first provider string as-is
    return this.cloudflare.chatCompletion(messages, {
      model: model?.startsWith("workers-ai/") ? model.slice("workers-ai/".length) : null,
    });
  }

  async generateReply(
    workspaceId: string,
    conversationId: string | null,
    lastMessageText: string,
  ): Promise<string> {
    if (!this.cloudflare.isConfigured && !this.gateway?.isConfigured) {
      return "Gracias por tu mensaje. Un agente te atenderá en breve.";
    }

    const [ctx, recentMessages] = await Promise.all([
      this.buildBusinessContext(workspaceId),
      conversationId
        ? this.prisma.message.findMany({
            where: { conversation_id: conversationId, workspace_id: workspaceId },
            orderBy: { sent_at: "desc" },
            take: 5,
            select: { body_text: true, direction: true },
          })
        : Promise.resolve([]),
    ]);

    const systemPrompt = this.buildSystemPrompt(ctx);

    const history: AssistantMessage[] = recentMessages
      .reverse()
      .slice(0, -1)
      .map((m) => ({
        role: m.direction === "OUTBOUND" ? "assistant" : "user",
        content: m.body_text ?? "",
      }));

    const messages: AssistantMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: lastMessageText },
    ];

    try {
      const result = await this.aiChat(messages, ctx.aiAgentProviders, { maxTokens: 1024, temperature: 0.3 });
      return result ?? "Gracias por tu mensaje. Un agente te atenderá pronto.";
    } catch (err) {
      this.logger.warn("EmrendeAI generateReply failed", err);
      return "Gracias por tu mensaje. Un agente te atenderá en breve.";
    }
  }

  async analyzeContactProfile(
    workspaceId: string,
    contactId: string,
  ): Promise<ContactProfileInsights> {
    if (!this.cloudflare.isConfigured && !this.gateway?.isConfigured) {
      throw new Error("Cloudflare AI is not configured");
    }

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspace_id: workspaceId },
      select: { id: true, full_name: true },
    });
    if (!contact) throw new Error("Contacto no encontrado");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const messages = await this.prisma.message.findMany({
      where: {
        workspace_id: workspaceId,
        sent_at: { gte: thirtyDaysAgo },
        conversation: { contact_id: contactId },
      },
      orderBy: { sent_at: "asc" },
      take: 60,
      select: { body_text: true, direction: true, sent_at: true },
    });

    if (messages.length === 0) {
      return {
        summary: "Sin conversaciones recientes para analizar.",
        common_requests: [],
        contact_frequency: "Sin datos",
        communication_style: "Sin datos",
      };
    }

    const transcript = messages
      .map((m) => `[${m.direction === "INBOUND" ? "Cliente" : "Negocio"}]: ${m.body_text ?? ""}`)
      .join("\n");
    const ctx = await this.buildBusinessContext(workspaceId);

    const prompt = `Analiza esta conversación de un cliente con un negocio y extrae un perfil de comportamiento.
Responde SOLO con un JSON válido con este formato exacto:
{
  "summary": "resumen en 1-2 oraciones de qué suele necesitar este cliente",
  "common_requests": ["solicitud 1", "solicitud 2"],
  "contact_frequency": "descripción de con qué frecuencia contacta (ej: varias veces por semana, ocasionalmente)",
  "communication_style": "descripción del tono (ej: directo y concreto, amigable y detallado)"
}
NO incluyas datos sensibles como ubicación exacta o datos financieros.

Conversación:
${transcript.slice(0, 3000)}`;

    const responseText = await this.aiChat(
      [{ role: "user", content: prompt }] as AssistantMessage[],
      ctx.aiAgentProviders,
      { maxTokens: 1024, temperature: 0.3 },
    );

    let insights: ContactProfileInsights;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      insights = JSON.parse(jsonMatch?.[0] ?? responseText);
    } catch {
      insights = {
        summary: responseText.slice(0, 200),
        common_requests: [],
        contact_frequency: "Sin datos",
        communication_style: "Sin datos",
      };
    }

    const existing = await this.prisma.contact.findUnique({
      where: { id: contactId },
      select: { extracted_data_json: true },
    });
    const existingData = parseJsonValue<Record<string, unknown>>(
      existing?.extracted_data_json,
      {},
    );

    await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        extracted_data_json: {
          ...existingData,
          ai_profile: { ...insights, analyzed_at: new Date().toISOString() },
        },
      },
    });

    return insights;
  }

  async suggestTasksFromMessage(
    workspaceId: string,
    messageText: string,
  ): Promise<TaskSuggestion[]> {
    if (!this.cloudflare.isConfigured && !this.gateway?.isConfigured) return [];

    const ctx = await this.buildBusinessContext(workspaceId);

    const prompt = `Eres asistente de un negocio (${this.describeBusinessType(ctx.categories)}).
Un cliente envió este mensaje: "${messageText.slice(0, 500)}"

¿Este mensaje implica alguna tarea pendiente para el negocio?
Responde SOLO con un JSON array. Si no implica tareas, responde [].
Formato: [{"title": "título máx 80 chars", "priority": "LOW|MEDIUM|HIGH", "description": "descripción breve"}]
No incluyas explicaciones, solo el JSON.`;

    try {
      const responseText = await this.aiChat(
        [{ role: "user", content: prompt }] as AssistantMessage[],
        ctx.aiAgentProviders,
        { maxTokens: 1024, temperature: 0.3 },
      );

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((t: any) => t.title && t.priority)
        .slice(0, 3)
        .map((t: any) => ({
          title: String(t.title).slice(0, 80),
          priority: ["LOW", "MEDIUM", "HIGH"].includes(t.priority) ? t.priority : "MEDIUM",
          description: String(t.description ?? ""),
        }));
    } catch (err) {
      this.logger.warn("suggestTasksFromMessage failed", err);
      return [];
    }
  }

  private describeBusinessType(categories: string[]): string {
    const MAP: Record<string, string> = {
      alimentacion_bebidas: "comida y bebidas",
      salud_bienestar: "salud y bienestar",
      comercio_ventas: "comercio y ventas",
      servicios_profesionales: "servicios profesionales",
      tecnologia: "tecnología",
      educacion: "educación",
      belleza_cuidado: "belleza y cuidado personal",
      transporte_logistica: "transporte y logística",
    };
    const mapped = categories.map((c) => MAP[c] ?? c).filter(Boolean);
    return mapped.length > 0 ? mapped.join(", ") : "servicios generales";
  }
}
