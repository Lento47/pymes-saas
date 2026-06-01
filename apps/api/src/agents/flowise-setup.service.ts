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

  /**
   * Returns the overrideConfig.vars object injected at prediction time
   * so Flowise Custom Tools can access $vars.GITHUB_TOKEN, $vars.RAILWAY_TOKEN, etc.
   */
  getPredictionVars(workspaceSlug?: string): Record<string, string> {
    const vars: Record<string, string> = {};
    const gh = this.config.get<string>("GITHUB_TOKEN");
    const rw = this.config.get<string>("RAILWAY_API_TOKEN");
    const rwSvc = this.config.get<string>("RAILWAY_SERVICE_ID");
    const pk = this.config.get<string>("PYMESHUB_FOUNDER_API_KEY");
    const ds = this.config.get<string>("GATEWAY_KEY_DEEPSEEK");

    if (gh) vars.GITHUB_TOKEN = gh;
    if (rw) vars.RAILWAY_TOKEN = rw;
    if (rwSvc) vars.RAILWAY_SERVICE_ID = rwSvc;
    if (pk) vars.PYMESHUB_API_KEY = pk;
    if (ds) vars.GATEWAY_KEY_DEEPSEEK = ds;
    if (workspaceSlug) vars.WORKSPACE_SLUG = workspaceSlug;
    return vars;
  }

  async setup(): Promise<void> {
    this.logger.log("[flowise-setup] ========================================");
    this.logger.log("[flowise-setup] SETUP STARTING — provisioning tools + agentflows");
    this.logger.log("[flowise-setup] ========================================");
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
          toolIds: toolPairs.map((p) => p.name),  // use names, not UUIDs — survives Flowise tool recreation
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

      // Resolve tool IDs: prefer cache, fall back to Flowise API live lookup.
      const toolPairs: { name: string; id: string }[] = [];
      for (const name of agent.tools) {
        let id = this._toolIdByName.get(name);
        if (!id) {
          // Cache miss — likely after Flowise DB reset. Resolve live.
          id = await this.flowise.getToolIdByName(name);
          if (id) this._toolIdByName.set(name, id); // repopulate cache
        }
        if (id) toolPairs.push({ name, id });
      }

      const missingTools = agent.tools.filter(
        (n) => !toolPairs.some((p) => p.name === n),
      );
      if (missingTools.length > 0) {
        this.logger.warn(
          `[flowise-setup] ${slug}: ${missingTools.length} tools not found in Flowise: ${missingTools.join(", ")}`,
        );
      }

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

  /**
   * Build tool definitions for Flowise.
   *
   * Architecture:
   *   GitHub tools → call GitHub REST API directly (using $vars.GITHUB_TOKEN)
   *   Railway tools → call Railway GraphQL directly (using $vars.RAILWAY_TOKEN)
   *   PymesHub read tools → call PymesHub REST API directly (using $vars.PYMESHUB_API_KEY)
   *   Write tools     → proxy through PymesHub /api/agent/tool (audit trail)
   *
   * Variables are injected at prediction time via overrideConfig.vars.
   */
  private buildToolDefs(apiBase: string, founderKey: string): Record<string, FlowiseToolDef> {
    // ── Helpers ──────────────────────────────────────────────────────────────

    const safeFetch = (moreCode: string): string =>
      [
        `const fetch = require('node-fetch');`,
        `try {`,
        ...moreCode.split("\n").map((l) => `  ${l}`),
        `} catch(e) { return JSON.stringify({ error: e.message || String(e) }); }`,
      ].join("\n");

    // Proxy through PymesHub (audited, workspace-scoped)
    const pymesHubProxy = (toolName: string): string =>
      safeFetch(
        [
          `const args = typeof $input === 'string' ? JSON.parse($input || '{}') : ($input || {});`,
          `const res = await fetch('${apiBase}/api/agent/tool', {`,
          `  method: 'POST',`,
          `  headers: { 'Authorization': 'Bearer ${founderKey}', 'Content-Type': 'application/json' },`,
          `  body: JSON.stringify({ tool: '${toolName}', arguments: args })`,
          `});`,
          `const data = await res.json();`,
          `if (!res.ok) throw new Error(data.message || 'Tool error HTTP ' + res.status);`,
          `return JSON.stringify(data);`,
        ].join("\n"),
      );

    // ── GitHub tools (native — call GitHub API directly) ─────────────────────

    const readGithubFile: FlowiseToolDef = {
      name: "read_github_file",
      description:
        "Lee el contenido de un archivo del repositorio de GitHub (pymes-saas). LLAMA A GITHUB DIRECTAMENTE — usa el GITHUB_TOKEN de Flowise. Args: { path: string, ref?: string (default: master) }",
      schema: JSON.stringify({
        type: "object",
        properties: { path: { type: "string" }, ref: { type: "string" } },
        required: ["path"],
      }),
      func: safeFetch(
        [
          `const token = $vars.GITHUB_TOKEN;`,
          `const repo = 'Lento47/pymes-saas';`,
          `const path = $path;`,
          `const ref = $ref || 'master';`,
          `const url = 'https://api.github.com/repos/' + repo + '/contents/' + path + '?ref=' + ref;`,
          `const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3.raw' } });`,
          `if (!res.ok) { const t = await res.text(); throw new Error(t.slice(0, 500)); }`,
          `return await res.text();`,
        ].join("\n"),
      ),
    };

    const searchGithubFiles: FlowiseToolDef = {
      name: "search_github_files",
      description:
        "Busca archivos en el repositorio pymes-saas por query. LLAMA A GITHUB DIRECTAMENTE. Args: { query: string, limit?: number }",
      schema: JSON.stringify({
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
        required: ["query"],
      }),
      func: safeFetch(
        [
          `const token = $vars.GITHUB_TOKEN;`,
          `const repo = 'Lento47/pymes-saas';`,
          `const q = $query + ' repo:' + repo;`,
          `const limit = $limit || 10;`,
          `const url = 'https://api.github.com/search/code?q=' + encodeURIComponent(q) + '&per_page=' + limit;`,
          `const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json' } });`,
          `const data = await res.json();`,
          `const items = (data.items || []).map(i => ({ path: i.path, repo: i.repository?.full_name }));`,
          `return JSON.stringify({ total: data.total_count, results: items });`,
        ].join("\n"),
      ),
    };

    const getRecentCommits: FlowiseToolDef = {
      name: "get_recent_commits",
      description:
        "Commits recientes del repo pymes-saas. LLAMA A GITHUB DIRECTAMENTE. Args: { path?: string, limit?: number }",
      schema: JSON.stringify({
        type: "object",
        properties: { path: { type: "string" }, limit: { type: "number" } },
        required: [],
      }),
      func: safeFetch(
        [
          `const token = $vars.GITHUB_TOKEN;`,
          `const repo = 'Lento47/pymes-saas';`,
          `const limit = $limit || 10;`,
          `let url = 'https://api.github.com/repos/' + repo + '/commits?per_page=' + limit;`,
          `if ($path) url += '&path=' + encodeURIComponent($path);`,
          `const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json' } });`,
          `const data = await res.json();`,
          `return JSON.stringify((Array.isArray(data) ? data : []).map(c => ({ sha: c.sha?.slice(0,7), message: (c.commit?.message || '').split('\\n')[0], author: c.commit?.author?.name, date: c.commit?.author?.date })));`,
        ].join("\n"),
      ),
    };

    // ── Railway tool (native — call Railway GraphQL directly) ─────────────────

    const getRailwayLogs: FlowiseToolDef = {
      name: "get_railway_logs",
      description:
        "Logs recientes del deployment de Railway. LLAMA A RAILWAY DIRECTAMENTE. Args: { limit?: number }",
      schema: JSON.stringify({
        type: "object",
        properties: { limit: { type: "number" } },
        required: [],
      }),
      func: safeFetch(
        [
          `const token = $vars.RAILWAY_TOKEN;`,
          `const serviceId = $vars.RAILWAY_SERVICE_ID;`,
          `const limit = $limit || 100;`,
          `const query = 'query($serviceId: String!, $limit: Int!) { deploymentLogs(serviceId: $serviceId, limit: $limit) { timestamp message severity } }';`,
          `const res = await fetch('https://backboard.railway.app/graphql/v2', {`,
          `  method: 'POST',`,
          `  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },`,
          `  body: JSON.stringify({ query, variables: { serviceId, limit } })`,
          `});`,
          `const json = await res.json();`,
          `const logs = json?.data?.deploymentLogs || [];`,
          `return JSON.stringify(logs.slice(-limit));`,
        ].join("\n"),
      ),
    };

    // ── PymesHub read tools (call PymesHub REST API directly) ─────────────────

    const pymesHubApi = (toolName: string, description: string, schemaStr: string, endpointExtra: string, paramMapping: string): FlowiseToolDef => ({
      name: toolName,
      description,
      schema: schemaStr,
      func: safeFetch(
        [
          `const apiKey = $vars.PYMESHUB_API_KEY;`,
          `const wsSlug = $vars.WORKSPACE_SLUG;`,
          `const apiBase = '${apiBase}';`,
          paramMapping,
          `const url = apiBase + '${endpointExtra}';`,
          `const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' } });`,
          `const data = await res.json();`,
          `if (!res.ok) throw new Error(data.message || 'API error HTTP ' + res.status);`,
          `return JSON.stringify(data);`,
        ].join("\n"),
      ),
    });

    // ── Write tools (proxy through PymesHub — audit trail) ────────────────────

    return {
      // GitHub (native)
      read_github_file: readGithubFile,
      search_github_files: searchGithubFiles,
      get_recent_commits: getRecentCommits,

      // Railway (native)
      get_railway_logs: getRailwayLogs,

      // PymesHub read (native REST)
      get_workspace_context: pymesHubApi(
        "get_workspace_context",
        "Identidad del workspace + plan + tier + conteos. Args: {}",
        JSON.stringify({ type: "object", properties: {}, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/full-context",
        "// wsSlug from $vars",
      ),
      get_workspace_data: pymesHubApi(
        "get_workspace_data",
        "Datos completos del workspace (contexto, plan, tier, conteos). Args: {}",
        JSON.stringify({ type: "object", properties: {}, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/full-context",
        "// Alias de get_workspace_context — usado por agentes de soporte",
      ),
      get_workspace_plan: pymesHubApi(
        "get_workspace_plan",
        "Plan y estado del workspace. Args: {}",
        JSON.stringify({ type: "object", properties: {}, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/plan",
        "",
      ),
      get_recent_errors: pymesHubApi(
        "get_recent_errors",
        "Error reports recientes. Args: { limit?: number }",
        JSON.stringify({ type: "object", properties: { limit: { type: "number" } }, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/errors?limit=" + "$limit || 20",
        "// limit from args, wsSlug from $vars",
      ),
      get_channel_status: pymesHubApi(
        "get_channel_status",
        "Estado de canales del workspace. Args: { type?: string }",
        JSON.stringify({ type: "object", properties: { type: { type: "string" } }, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/channels",
        "",
      ),
      get_billing_status: pymesHubApi(
        "get_billing_status",
        "Estado de suscripción/plan. Args: {}",
        JSON.stringify({ type: "object", properties: {}, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/billing",
        "",
      ),
      get_workflow_config: pymesHubApi(
        "get_workflow_config",
        "Config de automatizaciones del workspace. Args: { id?: string }",
        JSON.stringify({ type: "object", properties: { id: { type: "string" } }, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/workflows",
        "",
      ),
      list_fix_cases: pymesHubApi(
        "list_fix_cases",
        "Casos de fix pendientes/en progreso. Args: {}",
        JSON.stringify({ type: "object", properties: {}, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/fix-cases",
        "",
      ),
      list_diagnostic_cases: pymesHubApi(
        "list_diagnostic_cases",
        "Casos de diagnóstico del workspace. Args: {}",
        JSON.stringify({ type: "object", properties: {}, required: [] }),
        "/api/admin/workspace/" + "$wsSlug" + "/diagnostic-cases",
        "",
      ),

      // Write tools (proxy — audit trail)
      apply_github_fix: {
        name: "apply_github_fix",
        description: "Crea branch, commitea código corregido y abre PR REAL en GitHub. El content de cada archivo debe ser COMPLETO (no diff). Args: { branch_name, files: [{path, content}], pr_title, pr_body?, diagnostic_case_id? }",
        schema: JSON.stringify({
          type: "object",
          properties: {
            branch_name: { type: "string" },
            files: { type: "array", items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
            pr_title: { type: "string" },
            pr_body: { type: "string" },
            diagnostic_case_id: { type: "string" },
          },
          required: ["branch_name", "files", "pr_title"],
        }),
        func: pymesHubProxy("apply_github_fix"),
      },
      create_fix_proposal: {
        name: "create_fix_proposal",
        description: "Guarda propuesta de fix SIN abrir PR. files[].content debe ser archivo completo. Args: { files: [{path, content, reason?}], fix_summary?, rollback_notes?, diagnostic_case_id? }",
        schema: JSON.stringify({
          type: "object",
          properties: {
            diagnostic_case_id: { type: "string" },
            fix_summary: { type: "string" },
            rollback_notes: { type: "string" },
            files: { type: "array", items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" }, reason: { type: "string" } }, required: ["path", "content"] } },
          },
          required: ["files"],
        }),
        func: pymesHubProxy("create_fix_proposal"),
      },
      create_github_pr: {
        name: "create_github_pr",
        description: "Crea PR draft desde propuesta aprobada. Pasa por política de seguridad. files[].content debe ser archivo completo. Args: { branch_name, files: [{path, content}], pr_title, pr_body?, security_review_passed?, diagnostic_case_id? }",
        schema: JSON.stringify({
          type: "object",
          properties: {
            branch_name: { type: "string" },
            base_branch: { type: "string" },
            pr_title: { type: "string" },
            pr_body: { type: "string" },
            security_review_passed: { type: "boolean" },
            diagnostic_case_id: { type: "string" },
            files: { type: "array", items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
          },
          required: ["branch_name", "files", "pr_title"],
        }),
        func: pymesHubProxy("create_github_pr"),
      },
      add_internal_case_note: {
        name: "add_internal_case_note",
        description: "Añade nota interna de auditoría a un caso. Args: { diagnostic_case_id, note }",
        schema: JSON.stringify({
          type: "object",
          properties: { diagnostic_case_id: { type: "string" }, note: { type: "string" } },
          required: ["diagnostic_case_id", "note"],
        }),
        func: pymesHubProxy("add_internal_case_note"),
      },

      get_errors: {
        name: "get_errors",
        description: "Error reports recientes del sistema. (Alias de get_recent_errors — mantenido por compatibilidad con tier flows viejos).",
        schema: JSON.stringify({ type: "object", properties: { limit: { type: "number" } }, required: [] }),
        func: pymesHubProxy("get_errors"),
      },
    };
  }
}
