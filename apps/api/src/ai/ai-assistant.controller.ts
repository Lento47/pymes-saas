import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { AiProviderBalancerService } from "./ai-provider-balancer.service";
import { EmrendeAiService } from "./emprende-ai.service";

const FIELD_SYSTEM_PROMPTS: Record<string, string> = {
  ai_business_prompt:
    "Eres experto en configuración de asistentes IA para negocios latinoamericanos. El usuario está escribiendo las instrucciones principales de su agente IA. Mejora el texto: hazlo más claro, específico y accionable para que el agente sepa exactamente cómo comportarse. Devuelve SOLO el texto mejorado, sin explicaciones ni markdown.",
  ai_business_products_services:
    "Eres experto en configuración de agentes IA. El usuario describe los productos y servicios de su negocio para que el agente los conozca. Mejora el texto: organízalo mejor, hazlo más claro y completo. Devuelve SOLO el texto mejorado.",
  ai_business_policies:
    "Eres experto en configuración de agentes IA. El usuario escribe las políticas operativas de su negocio. Mejora el texto para que el agente IA las entienda y aplique correctamente. Sé claro y específico. Devuelve SOLO el texto mejorado.",
  ai_main_objective:
    "Eres experto en configuración de agentes IA. El usuario describe el objetivo principal de su agente. Reescríbelo de forma más concisa, clara y accionable. Devuelve SOLO el texto mejorado.",
  ai_cannot_do:
    "Eres experto en configuración de agentes IA. El usuario lista lo que su agente NO debe hacer. Mejora el texto: hazlo más explícito, sin ambigüedad, fácil de seguir por el agente. Devuelve SOLO el texto mejorado.",
  ai_escalation_conditions:
    "Eres experto en configuración de agentes IA. El usuario describe cuándo el agente debe escalar a un humano. Mejora el texto: sé específico, concreto y cubre los casos más importantes. Devuelve SOLO el texto mejorado.",
};

const DEFAULT_SYSTEM_PROMPT =
  "Eres experto en configuración de agentes IA para negocios. Mejora el texto del usuario para que sea más claro y útil como instrucción para un agente IA. Devuelve SOLO el texto mejorado, sin explicaciones ni markdown.";

@Controller("workspaces/current/ai")
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
  constructor(
    private readonly planLimits: PlanLimitsService,
    private readonly balancer: AiProviderBalancerService,
    private readonly emprendeAi: EmrendeAiService,
  ) {}

  @Post("assist")
  async assist(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() body: { field?: string; content?: string; input?: string },
  ) {
    await this.planLimits.enforceAiAccess(workspaceId);

    const content = (body.content ?? body.input ?? "").trim();
    if (!content) return { suggestion: "" };

    try {
      const ctx = await this.emprendeAi.buildBusinessContext(workspaceId);
      const systemPrompt = FIELD_SYSTEM_PROMPTS[body.field ?? ""] ?? DEFAULT_SYSTEM_PROMPT;

      const suggestion = await this.balancer.chatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        ctx.aiAgentProviders,
        { maxTokens: 400, temperature: 0.4 },
      );

      return { suggestion: suggestion.trim(), reply: suggestion.trim() };
    } catch {
      return { suggestion: "", reply: "" };
    }
  }
}
