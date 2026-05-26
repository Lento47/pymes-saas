import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

interface BusinessMemoryPatch {
  facts_json?: unknown[];
  policies_json?: unknown[];
  faq_json?: unknown[];
  tone_rules_json?: Record<string, unknown>;
  successful_patterns_json?: unknown[];
}

@Injectable()
export class BusinessMemoryService {
  private readonly logger = new Logger(BusinessMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(workspaceId: string) {
    const existing = await this.prisma.businessMemory.findUnique({
      where: { workspace_id: workspaceId },
    });
    if (existing) return existing;

    return this.prisma.businessMemory.create({
      data: { workspace_id: workspaceId },
    });
  }

  async update(workspaceId: string, patch: BusinessMemoryPatch) {
    await this.getOrCreate(workspaceId);
    return this.prisma.businessMemory.update({
      where: { workspace_id: workspaceId },
      data: {
        ...(patch.facts_json !== undefined && { facts_json: patch.facts_json }),
        ...(patch.policies_json !== undefined && { policies_json: patch.policies_json }),
        ...(patch.faq_json !== undefined && { faq_json: patch.faq_json }),
        ...(patch.tone_rules_json !== undefined && { tone_rules_json: patch.tone_rules_json }),
        ...(patch.successful_patterns_json !== undefined && {
          successful_patterns_json: patch.successful_patterns_json,
        }),
      },
    });
  }

  async buildContextString(workspaceId: string): Promise<string> {
    try {
      const mem = await this.prisma.businessMemory.findUnique({
        where: { workspace_id: workspaceId },
      });
      if (!mem) return "";

      const lines: string[] = ["[CONTEXTO DEL NEGOCIO]"];

      const faq = mem.faq_json as Array<{ q: string; a: string }> | null;
      if (faq?.length) {
        lines.push(
          "Preguntas frecuentes:\n" +
            faq
              .slice(0, 5)
              .map((f) => `- ${f.q}: ${f.a}`)
              .join("\n"),
        );
      }

      const policies = mem.policies_json as string[] | null;
      if (policies?.length) {
        lines.push("Políticas: " + policies.slice(0, 3).join("; "));
      }

      const tone = mem.tone_rules_json as Record<string, unknown> | null;
      if (tone) {
        const rules = Object.entries(tone)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        if (rules) lines.push(`Tono: ${rules}`);
      }

      return lines.length > 1 ? lines.join("\n") : "";
    } catch (err) {
      this.logger.warn(`Failed to build business context: ${(err as Error).message}`);
      return "";
    }
  }
}
