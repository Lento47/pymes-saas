/**
 * FlowiseSetupService
 *
 * Auto-imports 4 tiered support agentflows into Flowise on startup.
 * Called from AgentsModule.onModuleInit().
 *
 * Support tiers:
 *   Tier 1 — FREE / BETA_INFORMAL  : notification only
 *   Tier 2 — STARTER / EMPRENDE    : triage + recommendation (Flash)
 *   Tier 3 — GROWTH / BUSINESS     : full analysis, no auto-PR (Flash)
 *   Tier 4 — ENTERPRISE / BUSINESS_PLUS : full pipeline + auto-PR (Reasoner)
 *
 * Chatflow IDs are stored in AgentTemplate records (config_json.flowise_chatflow_id).
 * DiagnosticService reads these to route support cases to the right chatflow.
 */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import { FlowiseClient, FlowiseModelConfig } from "./flowise/flowise.client";
import type { FlowiseToolDef } from "./flowise/flowise.types";
import { SUPPORT_AGENTS } from "./support/support-agents.catalog";
import { SUPPORT_MODEL_NAME } from "./support/support-agent.types";

export const SUPPORT_TIER_SLUGS = {
  TIER_1: "support-tier-1-free",
  TIER_2: "support-tier-2-starter",
  TIER_3: "support-tier-3-business",
  TIER_4: "support-tier-4-enterprise",
} as const;

export const PLAN_TO_TIER: Record<string, keyof typeof SUPPORT_TIER_SLUGS> = {
  FREE:          "TIER_1",
  BETA_INFORMAL: "TIER_1",
  STARTER:       "TIER_2",
  EMPRENDE:      "TIER_2",
  GROWTH:        "TIER_3",
  BUSINESS:      "TIER_3",
  ENTERPRISE:    "TIER_4",
  BUSINESS_PLUS: "TIER_4",
};

interface TierConfig {
  slug: string;
  name: string;
  model: string;
  tools: string[];
  systemPrompt: string;
  autoApprove: boolean;
}

@Injectable()
export class FlowiseSetupService {
  private readonly logger = new Logger(FlowiseSetupService.name);

  // Cached after setup() so reprovisionSupportAgent() can rebuild a single flow.
  private _deepseekBaseUrl = "https://api.deepseek.com";
  private _deepseekCredentialId: string | undefined;
  private _toolIdByName = new Map<string, string>();
  // Tracks per-tier success/failure from the most recent setup() run.
  private readonly _lastTierResults = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly flowise: FlowiseClient,
  ) {}

  async setup(): Promise<void> {
    if (!this.flowise.isEnabled) {
      this.logger.warn("[flowise-setup] Flowise disabled — skipping tier agentflow setup");
      return;
    }

    const apiBase = this.config.get<string>("API_BASE_URL") ?? "https://api.pymeshub.lat";
    const founderKey = this.config.get<string>("PYMESHUB_FOUNDER_API_KEY") ?? "";
    const deepseekBaseUrl = this.config.get<string>("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com";

    const tiers: TierConfig[] = [
      {
        slug: SUPPORT_TIER_SLUGS.TIER_1,
        name: "PymesHub Soporte — Tier 1 (Free)",
        model: "deepseek-v4-flash",
        tools: [],
        autoApprove: false,
        systemPrompt:
          "Eres el sistema de soporte de PymesHub. Recibiste un reporte de error de un workspace en plan FREE.\n" +
          "Tu única tarea: confirmar que recibiste el reporte y dar una recomendación básica de qué puede intentar el usuario mientras el equipo revisa.\n" +
          "Sé breve, empático y profesional. No prometas tiempos de respuesta específicos. Máximo 3 párrafos.",
      },
      {
        slug: SUPPORT_TIER_SLUGS.TIER_2,
        name: "PymesHub Soporte — Tier 2 (Starter/Emprende)",
        model: "deepseek-v4-flash",
        tools: ["get_railway_logs", "get_errors", "list_diagnostic_cases"],
        autoApprove: false,
        systemPrompt:
          "Eres un agente de soporte técnico de PymesHub (plan Starter/Emprende).\n" +
          "Proceso:\n" +
          "1. USA get_railway_logs para ver errores recientes en producción.\n" +
          "2. USA get_errors para ver los error reports del workspace.\n" +
          "3. Clasifica el error y da una recomendación detallada con pasos concretos.\n" +
          "4. Si hay un workaround conocido, explícalo claramente.\n" +
          "NO generes código ni propongas fixes al código fuente. Solo recomendaciones de configuración y uso.\n" +
          "Responde en español. Sé claro y conciso.",
      },
      {
        slug: SUPPORT_TIER_SLUGS.TIER_3,
        name: "PymesHub Soporte — Tier 3 (Growth/Business)",
        model: "deepseek-v4-flash",
        tools: ["get_railway_logs", "get_errors", "read_github_file", "get_recent_commits", "list_fix_cases"],
        autoApprove: false,
        systemPrompt:
          "Eres un SRE senior de PymesHub analizando un bug para un workspace Business/Growth.\n" +
          "Stack: NestJS + Prisma + PostgreSQL (apps/api), React/Vite (apps/web). Repo: github.com/lento47/pymes-saas\n\n" +
          "Proceso OBLIGATORIO:\n" +
          "1. USA get_railway_logs — ve los logs reales de producción.\n" +
          "2. USA get_errors — error reports del workspace.\n" +
          "3. Identifica el archivo más probable.\n" +
          "4. USA read_github_file — lee el código real ANTES de cualquier análisis.\n" +
          "5. USA get_recent_commits — ¿hay una regresión reciente?\n" +
          "6. Analiza con el código real que leíste.\n" +
          "7. Genera un fix detallado con el código corregido.\n\n" +
          "IMPORTANTE: El fix se guarda como propuesta (FIX_READY). El admin lo aprueba manualmente.\n" +
          "Devuelve JSON con: { root_cause, fix_summary, files_to_fix: [{file, content_corrected, reason}] }\n" +
          "Responde en español.",
      },
      {
        slug: SUPPORT_TIER_SLUGS.TIER_4,
        name: "PymesHub Soporte — Tier 4 (Enterprise/Business+)",
        model: "deepseek-v4-pro",
        tools: ["get_railway_logs", "get_errors", "read_github_file", "get_recent_commits", "apply_github_fix", "list_fix_cases"],
        autoApprove: true,
        systemPrompt:
          "Eres un SRE senior con acceso completo al repositorio de PymesHub. Workspace en plan Enterprise/Business+.\n" +
          "Stack: NestJS + Prisma + PostgreSQL (apps/api), React/Vite (apps/web). Repo: github.com/lento47/pymes-saas\n\n" +
          "Proceso OBLIGATORIO — SIN EXCEPCIONES:\n" +
          "1. USA get_railway_logs — lee los logs reales. Identifica el error exacto.\n" +
          "2. USA get_errors — error reports categorizados.\n" +
          "3. Identifica el/los archivos afectados.\n" +
          "4. USA read_github_file — lee CADA archivo relevante. No asumas nada sin ver el código.\n" +
          "5. USA get_recent_commits — detecta regresiones.\n" +
          "6. Razona: ¿cuál es la causa raíz exacta?\n" +
          "7. Genera el código COMPLETO corregido (no diffs, el archivo entero).\n" +
          "8. USA apply_github_fix — crea el branch, commitea el código real y abre el PR.\n\n" +
          "REGLAS:\n" +
          "- El campo 'content' en apply_github_fix debe ser el archivo COMPLETO (no diff).\n" +
          "- branch_name: fix/auto-{modulo}-{timestamp}\n" +
          "- Si el fix toca múltiples archivos, inclúyelos todos en el mismo PR.\n" +
          "- Nunca adivines sin leer el código real primero.\n" +
          "Responde en español.",
      },
    ];

    // Step 1: Get/create DeepSeek credential in Flowise so Agent nodes can authenticate
    const deepseekKey = this.config.get<string>("GATEWAY_KEY_DEEPSEEK") ?? "";
    let deepseekCredentialId: string | undefined;
    if (deepseekKey) {
      deepseekCredentialId = await this.flowise
        .getOrCreateCredential("PymesHub DeepSeek", deepseekKey)
        .catch((err: any) => {
          this.logger.error(`[flowise-setup] Failed to create DeepSeek credential: ${err?.message}`);
          return undefined;
        });
    }

    // Step 3: Ensure all tool entities exist in Flowise
    const toolDefs = this.buildToolDefs(apiBase, founderKey);
    const existingTools = await this.flowise.listTools().catch(() => []);
    const toolIdByName = new Map(existingTools.map((t) => [t.name, t.id] as [string, string]));

    for (const [toolName, def] of Object.entries(toolDefs)) {
      if (!toolIdByName.has(toolName)) {
        try {
          const id = await this.flowise.createTool(def);
          toolIdByName.set(toolName, id);
          this.logger.log(`[flowise-setup] Created tool: ${toolName} (${id})`);
        } catch (err: any) {
          this.logger.error(`[flowise-setup] Failed to create tool ${toolName}: ${err?.message}`);
        }
      }
    }

    // Step 4: Create tier agentflows
    const existingChatflows = await this.flowise.listChatflows().catch(() => []);
    const existingByName = new Map<string, string>(existingChatflows.map((c) => [c.name, c.id] as [string, string]));

    for (const tier of tiers) {
      try {
        const isProModel = tier.model === "deepseek-v4-pro";
        const modelConfig: FlowiseModelConfig = {
          credentialId: deepseekCredentialId,
          modelName: tier.model,
          basepath: deepseekBaseUrl,
          temperature: isProModel ? 1.0 : 0.2,
        };
        const toolIdMap = Object.fromEntries(toolIdByName.entries()) as Record<string, string>;

        let flowData: string;
        if (tier.slug === SUPPORT_TIER_SLUGS.TIER_1) {
          flowData = this.flowise.buildTier1FlowData(modelConfig);
        } else if (tier.slug === SUPPORT_TIER_SLUGS.TIER_2) {
          flowData = this.flowise.buildTier2FlowData(modelConfig, toolIdMap);
        } else if (tier.slug === SUPPORT_TIER_SLUGS.TIER_3) {
          flowData = this.flowise.buildTier3FlowData(modelConfig, toolIdMap);
        } else {
          flowData = this.flowise.buildTier4FlowData(modelConfig, toolIdMap);
        }

        let chatflowId: string;
        if (existingByName.has(tier.name)) {
          chatflowId = existingByName.get(tier.name)!;
          this.logger.log(`[flowise-setup] Rebuilding tier agentflow: ${tier.name} (${chatflowId}), flowData ${flowData.length} bytes`);
          await this.flowise.updateChatflowWithData(chatflowId, tier.name, flowData);
          this.logger.log(`[flowise-setup] Updated tier agentflow: ${tier.name} (${chatflowId})`);
        } else {
          chatflowId = await this.flowise.createChatflowWithData(tier.name, flowData);
          this.logger.log(`[flowise-setup] Created tier agentflow: ${tier.name} (${chatflowId})`);
        }

        await this.prisma.agentTemplate.upsert({
          where: { slug: tier.slug },
          create: {
            slug: tier.slug,
            name: tier.name,
            description: `Agente de soporte automático — ${tier.name}`,
            provider: "FLOWISE",
            channel_scope: "ALL",
            is_published: false,
            is_free_tier: false,
            config_json: {
              is_support_agent: true,
              flowise_chatflow_id: chatflowId,
              auto_approve: tier.autoApprove,
              tier_slug: tier.slug,
            },
          },
          update: {
            config_json: {
              is_support_agent: true,
              flowise_chatflow_id: chatflowId,
              auto_approve: tier.autoApprove,
              tier_slug: tier.slug,
            },
          },
        });
        this._lastTierResults.set(tier.slug, "ok");
      } catch (err: any) {
        this.logger.error(`[flowise-setup] Failed to setup tier ${tier.slug}: ${err?.message}`);
        this._lastTierResults.set(tier.slug, err?.message ?? "unknown");
      }
    }

    // Step 5: Provision one agentflow per specialized support agent (catalog).
    await this.setupSpecializedAgents(deepseekBaseUrl, deepseekCredentialId, toolIdByName);

    // Cache params so reprovisionSupportAgent() can rebuild any single flow later.
    this._deepseekBaseUrl = deepseekBaseUrl;
    this._deepseekCredentialId = deepseekCredentialId;
    this._toolIdByName = toolIdByName;

    this.logger.log("[flowise-setup] Support tier agentflows ready");
  }

  /**
   * Provision one Flowise AgentFlow per specialized agent in the catalog.
   * Each flow is created with the agent's prompt, model, temperature, and the
   * subset of its declared tools that actually exist in Flowise. The chatflow
   * id is stored in an AgentTemplate (slug `support-agent-<slug>`) so the
   * orchestrator/runtime can route to it. Idempotent (skips existing by name).
   *
   * NOTE: provisioning a flow does NOT grant runtime permissions. PR creation
   * still flows through PrCreationPolicyService and plan checks at execution.
   */
  private async setupSpecializedAgents(
    deepseekBaseUrl: string,
    deepseekCredentialId: string | undefined,
    toolIdByName: Map<string, string>,
  ): Promise<void> {
    const existing = await this.flowise.listChatflows().catch(() => []);
    const existingByName = new Map(existing.map((c) => [c.name, c.id] as [string, string]));

    for (const agent of SUPPORT_AGENTS) {
      const flowName = `PymesHub Agente — ${agent.name}`;
      try {
        const toolPairs = agent.tools
          .map((name) => ({ name, id: toolIdByName.get(name) }))
          .filter((p): p is { name: string; id: string } => !!p.id);
        const agentFlowData = this.flowise.buildSupportFlowData({
          modelName: SUPPORT_MODEL_NAME[agent.model],
          systemPrompt: agent.systemPrompt,
          toolIds: toolPairs.map((p) => p.id),
          toolNames: toolPairs.map((p) => p.name),
          basepath: deepseekBaseUrl,
          temperature: agent.temperature,
          credentialId: deepseekCredentialId,
        });

        let chatflowId: string;
        if (existingByName.has(flowName)) {
          chatflowId = existingByName.get(flowName)!;
          await this.flowise.updateChatflowWithData(chatflowId, flowName, agentFlowData);
        } else {
          chatflowId = await this.flowise.createChatflowWithData(flowName, agentFlowData);
          this.logger.log(`[flowise-setup] Created specialized agentflow: ${flowName} (${chatflowId})`);
        }

        await this.prisma.agentTemplate.upsert({
          where: { slug: `support-agent-${agent.slug}` },
          create: {
            slug: `support-agent-${agent.slug}`,
            name: agent.name,
            description: agent.role,
            provider: "FLOWISE",
            channel_scope: "ALL",
            is_published: false,
            is_free_tier: false,
            config_json: {
              is_support_agent: true,
              support_agent_slug: agent.slug,
              flowise_chatflow_id: chatflowId,
              tier_access: agent.tierAccess,
              tools: agent.tools,
              can_create_pr: agent.canCreatePr,
              requires_security_review: agent.requiresSecurityReview,
              requires_human_approval: agent.requiresHumanApproval,
            },
          },
          update: {
            config_json: {
              is_support_agent: true,
              support_agent_slug: agent.slug,
              flowise_chatflow_id: chatflowId,
              tier_access: agent.tierAccess,
              tools: agent.tools,
              can_create_pr: agent.canCreatePr,
              requires_security_review: agent.requiresSecurityReview,
              requires_human_approval: agent.requiresHumanApproval,
            },
          },
        });
      } catch (err: any) {
        this.logger.error(`[flowise-setup] Failed to provision agent ${agent.slug}: ${err?.message}`);
      }
    }

    this.logger.log(`[flowise-setup] ${SUPPORT_AGENTS.length} specialized agentflows ready`);
  }

  /**
   * Re-create the Flowise AgentFlow for a single support agent and update the
   * AgentTemplate record. Called when the orchestrator detects a stale chatflow ID.
   * Returns the new chatflow ID, or null if reprovisioning failed.
   */
  async reprovisionSupportAgent(slug: string): Promise<string | null> {
    if (!this.flowise.isEnabled) return null;
    const agent = SUPPORT_AGENTS.find((a) => a.slug === slug);
    if (!agent) return null;
    try {
      const flowName = `PymesHub Agente — ${agent.name}`;
      const toolPairs = agent.tools
        .map((name) => ({ name, id: this._toolIdByName.get(name) }))
        .filter((p): p is { name: string; id: string } => !!p.id);
      const flowData = this.flowise.buildSupportFlowData({
        modelName: SUPPORT_MODEL_NAME[agent.model],
        systemPrompt: agent.systemPrompt,
        toolIds: toolPairs.map((p) => p.id),
        toolNames: toolPairs.map((p) => p.name),
        basepath: this._deepseekBaseUrl,
        temperature: agent.temperature,
        credentialId: this._deepseekCredentialId,
      });
      const chatflowId = await this.flowise.createChatflowWithData(flowName, flowData);
      await this.prisma.agentTemplate.update({
        where: { slug: `support-agent-${slug}` },
        data: {
          config_json: {
            is_support_agent: true,
            support_agent_slug: slug,
            flowise_chatflow_id: chatflowId,
            tier_access: agent.tierAccess,
            tools: agent.tools,
            can_create_pr: agent.canCreatePr,
            requires_security_review: agent.requiresSecurityReview,
            requires_human_approval: agent.requiresHumanApproval,
          },
        },
      });
      this.logger.log(`[flowise-setup] Reprovisioned support agent ${slug} → ${chatflowId}`);
      return chatflowId;
    } catch (err: any) {
      this.logger.error(`[flowise-setup] reprovisionSupportAgent(${slug}) failed: ${err?.message}`);
      return null;
    }
  }

  /** Force-rebuild all tier agentflows and specialized agent flows. Safe to call at any time. */
  async reprovisionAllFlows(): Promise<{ rebuilt: string[]; failed: string[] }> {
    const rebuilt: string[] = [];
    const failed: string[] = [];
    this.logger.log("[flowise-setup] reprovisionAllFlows triggered manually");
    this._lastTierResults.clear();
    try {
      await this.setup();
    } catch (err: any) {
      this.logger.error(`[flowise-setup] reprovisionAllFlows failed: ${err?.message}`);
      failed.push(err?.message ?? "unknown");
      return { rebuilt, failed };
    }
    for (const slug of Object.values(SUPPORT_TIER_SLUGS)) {
      const result = this._lastTierResults.get(slug);
      if (result === "ok") {
        rebuilt.push(slug);
      } else if (result) {
        failed.push(`${slug}: ${result}`);
      } else {
        failed.push(`${slug}: not reached`);
      }
    }
    return { rebuilt, failed };
  }

  /** Get the Flowise chatflow ID for a workspace plan */
  async getChatflowIdForPlan(plan: string): Promise<string | null> {
    const tierKey = PLAN_TO_TIER[plan] ?? "TIER_1";
    const slug = SUPPORT_TIER_SLUGS[tierKey];
    try {
      const template = await this.prisma.agentTemplate.findUnique({
        where: { slug },
        select: { config_json: true },
      });
      const cfg = template?.config_json as Record<string, any> | null;
      return (cfg?.flowise_chatflow_id as string) ?? null;
    } catch {
      return null;
    }
  }

  /** Returns true if the plan's tier auto-approves PRs */
  isAutoApprovePlan(plan: string): boolean {
    return plan === "ENTERPRISE" || plan === "BUSINESS_PLUS";
  }

  /** Get the Flowise chatflow ID for a specialized support agent by slug. */
  async getChatflowIdForAgent(slug: string): Promise<string | null> {
    try {
      const template = await this.prisma.agentTemplate.findUnique({
        where: { slug: `support-agent-${slug}` },
        select: { config_json: true },
      });
      const cfg = template?.config_json as Record<string, any> | null;
      return (cfg?.flowise_chatflow_id as string) ?? null;
    } catch {
      return null;
    }
  }

  private buildToolDefs(apiBase: string, founderKey: string): Record<string, FlowiseToolDef> {
    const makeFunc = (toolName: string): string =>
      [
        `const args = typeof input === 'string' ? JSON.parse(input || '{}') : (input || {});`,
        `const res = await fetch('${apiBase}/api/agent/tool', {`,
        `  method: 'POST',`,
        `  headers: { 'Authorization': 'Bearer ${founderKey}', 'Content-Type': 'application/json' },`,
        `  body: JSON.stringify({ tool: '${toolName}', arguments: args })`,
        `});`,
        `if (!res.ok) { const e = await res.text(); throw new Error('Tool error: ' + e); }`,
        `const data = await res.json();`,
        `return JSON.stringify(data);`,
      ].join("\n");

    return {
      get_railway_logs: {
        name: "get_railway_logs",
        description: "Obtiene los logs recientes del deployment de la API en Railway. USAR SIEMPRE PRIMERO para diagnosticar errores en producción.",
        schema: JSON.stringify({
          type: "object",
          properties: { limit: { type: "number", description: "Número máximo de líneas de log a retornar" } },
          required: [],
        }),
        func: makeFunc("get_railway_logs"),
      },
      get_errors: {
        name: "get_errors",
        description: "Obtiene los error reports recientes del workspace o del sistema.",
        schema: JSON.stringify({
          type: "object",
          properties: { limit: { type: "number", description: "Número máximo de errores a retornar" } },
          required: [],
        }),
        func: makeFunc("get_errors"),
      },
      read_github_file: {
        name: "read_github_file",
        description: "Lee el contenido de un archivo del repositorio de GitHub. SIEMPRE leer antes de proponer un fix.",
        schema: JSON.stringify({
          type: "object",
          properties: {
            path: { type: "string", description: "Ruta del archivo en el repositorio (ej: apps/api/src/auth/auth.service.ts)" },
            ref: { type: "string", description: "Branch o commit SHA (opcional, default: master)" },
          },
          required: ["path"],
        }),
        func: makeFunc("read_github_file"),
      },
      get_recent_commits: {
        name: "get_recent_commits",
        description: "Obtiene commits recientes. Si se provee path, filtra por archivo específico. Útil para detectar regresiones.",
        schema: JSON.stringify({
          type: "object",
          properties: {
            path: { type: "string", description: "Ruta del archivo a revisar (opcional)" },
            limit: { type: "number", description: "Número máximo de commits" },
          },
          required: [],
        }),
        func: makeFunc("get_recent_commits"),
      },
      apply_github_fix: {
        name: "apply_github_fix",
        description: "Crea un branch, commitea el código corregido y abre un PR. El content de cada archivo debe ser el archivo COMPLETO.",
        schema: JSON.stringify({
          type: "object",
          properties: {
            branch_name: { type: "string", description: "Nombre del branch (ej: fix/auto-auth-1234567890)" },
            files: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  content: { type: "string", description: "Contenido completo del archivo corregido" },
                },
                required: ["path", "content"],
              },
            },
            pr_title: { type: "string", description: "Título del PR" },
            pr_body: { type: "string", description: "Descripción del PR (opcional)" },
            diagnostic_case_id: { type: "string", description: "ID del caso de diagnóstico (opcional)" },
          },
          required: ["branch_name", "files", "pr_title"],
        }),
        func: makeFunc("apply_github_fix"),
      },
      list_fix_cases: {
        name: "list_fix_cases",
        description: "Lista los casos de fix pendientes o en proceso.",
        schema: JSON.stringify({ type: "object", properties: {}, required: [] }),
        func: makeFunc("list_fix_cases"),
      },
      list_diagnostic_cases: {
        name: "list_diagnostic_cases",
        description: "Lista los casos de diagnóstico del workspace.",
        schema: JSON.stringify({ type: "object", properties: {}, required: [] }),
        func: makeFunc("list_diagnostic_cases"),
      },

      // ── Support multi-agent: context + privileged tools ──
      get_workspace_context: {
        name: "get_workspace_context",
        description: "Identidad del workspace + plan + tier + conteos de alto nivel. Úsalo primero para entender el contexto.",
        schema: JSON.stringify({ type: "object", properties: {}, required: [] }),
        func: makeFunc("get_workspace_context"),
      },
      get_workspace_plan: {
        name: "get_workspace_plan",
        description: "Plan, estado y tier del workspace.",
        schema: JSON.stringify({ type: "object", properties: {}, required: [] }),
        func: makeFunc("get_workspace_plan"),
      },
      get_recent_errors: {
        name: "get_recent_errors",
        description: "Error reports recientes del workspace.",
        schema: JSON.stringify({ type: "object", properties: { limit: { type: "number" } }, required: [] }),
        func: makeFunc("get_recent_errors"),
      },
      get_conversation_context: {
        name: "get_conversation_context",
        description: "Detalle de una conversación y sus mensajes. Requiere id.",
        schema: JSON.stringify({ type: "object", properties: { id: { type: "string" } }, required: ["id"] }),
        func: makeFunc("get_conversation_context"),
      },
      get_channel_status: {
        name: "get_channel_status",
        description: "Estado de conexión de los canales (sin secretos). Opcional: type (WHATSAPP/TELEGRAM/EMAIL).",
        schema: JSON.stringify({ type: "object", properties: { type: { type: "string" } }, required: [] }),
        func: makeFunc("get_channel_status"),
      },
      get_whatsapp_status: {
        name: "get_whatsapp_status",
        description: "Estado de conexión de los canales de WhatsApp (sin secretos).",
        schema: JSON.stringify({ type: "object", properties: {}, required: [] }),
        func: makeFunc("get_whatsapp_status"),
      },
      get_telegram_status: {
        name: "get_telegram_status",
        description: "Estado de conexión de los canales de Telegram (sin secretos).",
        schema: JSON.stringify({ type: "object", properties: {}, required: [] }),
        func: makeFunc("get_telegram_status"),
      },
      get_billing_status: {
        name: "get_billing_status",
        description: "Estado de suscripción y plan. Nunca modifica nada.",
        schema: JSON.stringify({ type: "object", properties: {}, required: [] }),
        func: makeFunc("get_billing_status"),
      },
      get_workflow_config: {
        name: "get_workflow_config",
        description: "Configuración de automatizaciones/reglas del workspace. Opcional: id.",
        schema: JSON.stringify({ type: "object", properties: { id: { type: "string" } }, required: [] }),
        func: makeFunc("get_workflow_config"),
      },
      add_internal_case_note: {
        name: "add_internal_case_note",
        description: "Añade una nota interna de auditoría a un caso de diagnóstico del workspace.",
        schema: JSON.stringify({
          type: "object",
          properties: { diagnostic_case_id: { type: "string" }, note: { type: "string" } },
          required: ["diagnostic_case_id", "note"],
        }),
        func: makeFunc("add_internal_case_note"),
      },
      search_github_files: {
        name: "search_github_files",
        description: "Busca archivos en el repositorio por contenido/ruta. Devuelve rutas coincidentes.",
        schema: JSON.stringify({
          type: "object",
          properties: { query: { type: "string" }, limit: { type: "number" } },
          required: ["query"],
        }),
        func: makeFunc("search_github_files"),
      },
      create_fix_proposal: {
        name: "create_fix_proposal",
        description: "Guarda una propuesta de fix SIN abrir PR. files[].content debe ser el archivo completo.",
        schema: JSON.stringify({
          type: "object",
          properties: {
            diagnostic_case_id: { type: "string" },
            fix_summary: { type: "string" },
            rollback_notes: { type: "string" },
            files: {
              type: "array",
              items: {
                type: "object",
                properties: { path: { type: "string" }, content: { type: "string" }, reason: { type: "string" } },
                required: ["path", "content"],
              },
            },
          },
          required: ["files"],
        }),
        func: makeFunc("create_fix_proposal"),
      },
      create_github_pr: {
        name: "create_github_pr",
        description:
          "Crea un PR draft (nunca merge/aprobación) desde una propuesta. Pasa por la política de seguridad. files[].content debe ser el archivo completo. Requiere security_review_passed=true para áreas sensibles.",
        schema: JSON.stringify({
          type: "object",
          properties: {
            branch_name: { type: "string", description: "fix/ai/<area>/<timestamp>" },
            base_branch: { type: "string" },
            pr_title: { type: "string" },
            pr_body: { type: "string" },
            security_review_passed: { type: "boolean" },
            diagnostic_case_id: { type: "string" },
            files: {
              type: "array",
              items: {
                type: "object",
                properties: { path: { type: "string" }, content: { type: "string" } },
                required: ["path", "content"],
              },
            },
          },
          required: ["branch_name", "files", "pr_title"],
        }),
        func: makeFunc("create_github_pr"),
      },
    };
  }
}
