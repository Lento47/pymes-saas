/**
 * SupportAgentTemplateSeed
 *
 * Ensures the "Agente de Soporte Técnico" template exists in the database.
 * Called from AgentsModule.onModuleInit() so it runs on every deploy —
 * safe to run multiple times (upsert by slug).
 *
 * The template carries `config_json.is_support_agent = true` so that
 * DiagnosticService can locate agent instances installed from this template
 * when auto-dispatching on PRODUCT_BUG / PLATFORM_INCIDENT errors.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

const SUPPORT_AGENT_SLUG = "support-tecnico-plataforma";

const SUPPORT_AGENT_INSTRUCTIONS = `Eres un agente de soporte técnico especializado para la plataforma PymesHub.
Tu objetivo es analizar errores, diagnosticar causas raíz y proponer fixes estructurados.

ROL: Senior SRE / Backend Engineer
STACK: NestJS, Prisma, PostgreSQL, React/Vite, WhatsApp/Telegram integrations

Cuando recibas un reporte de error, responde en JSON con este formato:
{
  "analysis": "Descripción técnica del problema",
  "root_cause": "Causa raíz identificada",
  "affected_files": ["archivo1.ts", "archivo2.ts"],
  "fix_steps": [
    { "step": 1, "action": "Qué hacer", "file": "archivo.ts", "code_hint": "snippet opcional" }
  ],
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "estimated_effort": "30min|2h|1d|1w",
  "rollback_notes": "Cómo revertir si el fix falla"
}

Sé preciso. No inventes código que no ves. Si no tienes suficiente contexto, indica qué información adicional necesitas.`;

@Injectable()
export class SupportAgentTemplateSeed {
  private readonly logger = new Logger(SupportAgentTemplateSeed.name);

  constructor(private readonly prisma: PrismaService) {}

  async seed(): Promise<void> {
    try {
      await this.prisma.agentTemplate.upsert({
        where: { slug: SUPPORT_AGENT_SLUG },
        create: {
          slug: SUPPORT_AGENT_SLUG,
          name: "Agente de Soporte Técnico",
          description:
            "Detecta errores de plataforma, analiza causas raíz y propone fixes estructurados con diffs de código. Se activa automáticamente en errores PRODUCT_BUG y PLATFORM_INCIDENT de severidad HIGH/CRITICAL.",
          provider: "INTERNAL",
          channel_scope: "ALL",
          is_published: true,
          is_free_tier: false,
          sort_order: -10, // Pin at top of templates list
          config_json: {
            is_support_agent: true,
            auto_trigger_categories: ["PRODUCT_BUG", "PLATFORM_INCIDENT"],
            auto_trigger_risk_levels: ["HIGH", "CRITICAL"],
            response_format: "json_analysis",
          },
        },
        update: {
          name: "Agente de Soporte Técnico",
          description:
            "Detecta errores de plataforma, analiza causas raíz y propone fixes estructurados con diffs de código. Se activa automáticamente en errores PRODUCT_BUG y PLATFORM_INCIDENT de severidad HIGH/CRITICAL.",
          is_published: true,
          config_json: {
            is_support_agent: true,
            auto_trigger_categories: ["PRODUCT_BUG", "PLATFORM_INCIDENT"],
            auto_trigger_risk_levels: ["HIGH", "CRITICAL"],
            response_format: "json_analysis",
          },
        },
      });

      // Also upsert the system_instructions on all existing instances
      // (non-destructive: only fills in if instructions are blank)
      const instances = await this.prisma.agentInstance.findMany({
        where: {
          template: { slug: SUPPORT_AGENT_SLUG },
          system_instructions: null,
        },
        select: { id: true },
      });

      for (const inst of instances) {
        await this.prisma.agentInstance.update({
          where: { id: inst.id },
          data: { system_instructions: SUPPORT_AGENT_INSTRUCTIONS },
        });
      }

      this.logger.log(
        `[support-agent-seed] template upserted, ${instances.length} instance(s) patched`,
      );
    } catch (err: any) {
      // Don't crash the server if seed fails — just log
      this.logger.warn(`[support-agent-seed] seed failed: ${err?.message}`);
    }
  }
}
