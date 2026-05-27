/**
 * FlowiseSetupService
 *
 * Auto-imports 4 tiered support chatflows into Flowise on startup.
 * Called from AgentsModule.onModuleInit().
 *
 * Support tiers:
 *   Tier 1 — FREE / BETA_INFORMAL  : notification only
 *   Tier 2 — STARTER / EMPRENDE    : triage + recommendation (Flash)
 *   Tier 3 — GROWTH / BUSINESS     : full analysis, no auto-PR (V4 Flash)
 *   Tier 4 — ENTERPRISE / BUSINESS_PLUS : full pipeline + auto-PR (V4 Pro)
 *
 * Chatflow IDs are stored in AgentTemplate records (config_json.flowise_chatflow_id).
 * DiagnosticService reads these to route support cases to the right chatflow.
 */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import { FlowiseClient } from "./flowise/flowise.client";

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

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly flowise: FlowiseClient,
  ) {}

  async setup(): Promise<void> {
    if (!this.flowise.isEnabled) {
      this.logger.warn("[flowise-setup] Flowise disabled — skipping tier chatflow setup");
      return;
    }

    const apiBase = this.config.get<string>("API_BASE_URL") ?? "https://api.pymeshub.lat";
    const founderKey = this.config.get<string>("PYMESHUB_FOUNDER_API_KEY") ?? "";
    const cfAccountId = this.config.get<string>("CF_GATEWAY_ACCOUNT_ID") ?? "";
    const cfGatewayId = this.config.get<string>("CF_GATEWAY_ID") ?? "pymeshub";
    const deepseekFlashKey = this.config.get<string>("GATEWAY_KEY_DEEPSEEK") ?? "";

    // Model base URLs via Cloudflare AI Gateway
    const flashBaseUrl = `https://gateway.ai.cloudflare.com/v1/${cfAccountId}/${cfGatewayId}/deepseek`;
    const proBaseUrl   = `https://gateway.ai.cloudflare.com/v1/${cfAccountId}/${cfGatewayId}/deepseek`;

    const tiers: TierConfig[] = [
      {
        slug: SUPPORT_TIER_SLUGS.TIER_1,
        name: "PymesHub Soporte — Tier 1 (Free)",
        model: "deepseek-chat",
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
        model: "deepseek-chat",
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
        model: "deepseek-chat",
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
        model: "deepseek-reasoner",
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

    const existingChatflows = await this.flowise.listChatflows().catch(() => []);
    const existingNames = new Set(existingChatflows.map((c) => c.name));
    const existingByName = new Map(existingChatflows.map((c) => [c.name, c.id]));

    for (const tier of tiers) {
      try {
        let chatflowId: string;

        if (existingByName.has(tier.name)) {
          chatflowId = existingByName.get(tier.name)!;
          this.logger.log(`[flowise-setup] Tier chatflow already exists: ${tier.name} (${chatflowId})`);
        } else {
          const flowData = this.buildSupportFlowData(tier, apiBase, founderKey, flashBaseUrl, proBaseUrl, deepseekFlashKey);
          chatflowId = await this.flowise.createChatflowWithData(tier.name, JSON.stringify(flowData));
          this.logger.log(`[flowise-setup] Created tier chatflow: ${tier.name} (${chatflowId})`);
        }

        // Upsert AgentTemplate with the chatflow ID
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
      } catch (err: any) {
        this.logger.error(`[flowise-setup] Failed to setup tier ${tier.slug}: ${err?.message}`);
        // Non-fatal — continue with other tiers
      }
    }

    this.logger.log("[flowise-setup] Support tier chatflows ready");
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

  private buildSupportFlowData(
    tier: TierConfig,
    apiBase: string,
    founderKey: string,
    flashBaseUrl: string,
    proBaseUrl: string,
    deepseekKey: string,
  ) {
    const isProModel = tier.model === "deepseek-reasoner";
    const baseUrl = isProModel ? proBaseUrl : flashBaseUrl;

    const modelNode = {
      id: "chatOpenAI_0",
      position: { x: 100, y: 100 },
      type: "customNode",
      data: {
        id: "chatOpenAI_0",
        label: "ChatOpenAI",
        name: "chatOpenAI",
        type: "BaseChatModel",
        inputs: {
          modelName: tier.model,
          temperature: isProModel ? 1.0 : 0.2,
          maxTokens: isProModel ? 16000 : 8000,
          openAIApiKey: deepseekKey,
          openAIBasePath: baseUrl,
        },
        outputs: { output: "chatOpenAI_0-output-BaseChatModel" },
        outputAnchors: [{ id: "chatOpenAI_0-output-BaseChatModel", label: "BaseChatModel", name: "output", description: "BaseChatModel" }],
      },
    };

    const memoryNode = {
      id: "bufferMemory_0",
      position: { x: 100, y: 300 },
      type: "customNode",
      data: {
        id: "bufferMemory_0",
        label: "Buffer Memory",
        name: "bufferMemory",
        type: "BaseChatMemory",
        inputs: { memoryKey: "chat_history", inputKey: "input" },
        outputs: { output: "bufferMemory_0-output-BaseChatMemory" },
        outputAnchors: [{ id: "bufferMemory_0-output-BaseChatMemory", label: "BaseChatMemory", name: "output" }],
      },
    };

    const toolNodes = tier.tools.map((toolName, i) => {
      const toolDescriptions: Record<string, string> = {
        get_railway_logs: "Obtiene los logs recientes del deployment de la API en Railway. USAR SIEMPRE PRIMERO. Args: { limit?: number }",
        get_errors: "Obtiene los error reports recientes del workspace. Args: { limit?: number }",
        read_github_file: "Lee el contenido de un archivo del repositorio. LEER SIEMPRE antes de proponer un fix. Args: { path: string, ref?: string }",
        get_recent_commits: "Obtiene commits recientes que modificaron un archivo. Args: { path: string, limit?: number }",
        apply_github_fix: "Crea branch + commits código real + abre PR. El content de cada file debe ser el archivo COMPLETO. Args: { branch_name, files:[{path,content}], pr_title, pr_body?, diagnostic_case_id? }",
        list_fix_cases: "Lista los fix cases pendientes. Args: {}",
        list_diagnostic_cases: "Lista los casos de diagnóstico del workspace. Args: {}",
      };

      return {
        id: `customTool_${i}`,
        position: { x: 500 + i * 20, y: 100 + i * 80 },
        type: "customNode",
        data: {
          id: `customTool_${i}`,
          label: toolName,
          name: "customTool",
          type: "Tool",
          inputs: {
            name: toolName,
            description: toolDescriptions[toolName] ?? toolName,
            url: `${apiBase}/api/agent/tool`,
            method: "POST",
            headers: JSON.stringify({
              Authorization: `Bearer ${founderKey}`,
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              workspace_slug: "{{workspace_slug}}",
              tool: toolName,
              arguments: "{{input}}",
            }),
          },
          outputs: { output: `customTool_${i}-output-Tool` },
          outputAnchors: [{ id: `customTool_${i}-output-Tool`, label: "Tool", name: "output" }],
        },
      };
    });

    const agentNode = {
      id: "openAIFunctionAgent_0",
      position: { x: 700, y: 300 },
      type: "customNode",
      data: {
        id: "openAIFunctionAgent_0",
        label: "OpenAI Function Agent",
        name: "openAIFunctionAgent",
        type: "AgentExecutor",
        inputs: {
          tools: toolNodes.map((t) => t.id),
          memory: "bufferMemory_0",
          model: "chatOpenAI_0",
          systemMessage: tier.systemPrompt,
        },
        outputs: { output: "openAIFunctionAgent_0-output-AgentExecutor" },
        outputAnchors: [{ id: "openAIFunctionAgent_0-output-AgentExecutor", label: "AgentExecutor", name: "output" }],
      },
    };

    const edges = [
      { id: "e-model", source: "chatOpenAI_0", target: "openAIFunctionAgent_0", sourceHandle: "chatOpenAI_0-output-BaseChatModel", targetHandle: "openAIFunctionAgent_0-input-model-BaseChatModel" },
      { id: "e-memory", source: "bufferMemory_0", target: "openAIFunctionAgent_0", sourceHandle: "bufferMemory_0-output-BaseChatMemory", targetHandle: "openAIFunctionAgent_0-input-memory-BaseChatMemory" },
      ...toolNodes.map((t, i) => ({
        id: `e-tool-${i}`,
        source: t.id,
        target: "openAIFunctionAgent_0",
        sourceHandle: `${t.id}-output-Tool`,
        targetHandle: "openAIFunctionAgent_0-input-tools-Tool",
      })),
    ];

    return {
      nodes: [modelNode, memoryNode, ...toolNodes, agentNode],
      edges,
    };
  }
}
