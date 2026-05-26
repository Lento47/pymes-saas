import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";

interface InsightPatch {
  intent?: string;
  sentiment?: string;
  summary?: string;
  unresolved_items_json?: unknown[];
  suggested_actions_json?: unknown[];
}

@Injectable()
export class ConversationInsightService {
  private readonly logger = new Logger(ConversationInsightService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(workspaceId: string, conversationId: string) {
    const existing = await this.prisma.conversationInsight.findUnique({
      where: { conversation_id: conversationId },
    });
    if (existing) return existing;

    return this.prisma.conversationInsight.create({
      data: { workspace_id: workspaceId, conversation_id: conversationId },
    });
  }

  async update(workspaceId: string, conversationId: string, patch: InsightPatch) {
    await this.getOrCreate(workspaceId, conversationId);
    return this.prisma.conversationInsight.update({
      where: { conversation_id: conversationId },
      data: {
        ...(patch.intent !== undefined && { intent: patch.intent }),
        ...(patch.sentiment !== undefined && { sentiment: patch.sentiment }),
        ...(patch.summary !== undefined && { summary: patch.summary }),
        ...(patch.unresolved_items_json !== undefined && {
          unresolved_items_json: patch.unresolved_items_json as Prisma.InputJsonValue,
        }),
        ...(patch.suggested_actions_json !== undefined && {
          suggested_actions_json: patch.suggested_actions_json as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async buildContextString(workspaceId: string, conversationId: string): Promise<string> {
    try {
      const insight = await this.prisma.conversationInsight.findFirst({
        where: { conversation_id: conversationId, workspace_id: workspaceId },
      });
      if (!insight) return "";

      const lines: string[] = ["[ESTADO DE LA CONVERSACIÓN]"];

      if (insight.intent) lines.push(`Intención detectada: ${insight.intent}`);
      if (insight.sentiment) lines.push(`Sentimiento: ${insight.sentiment}`);
      if (insight.summary) lines.push(`Resumen: ${insight.summary}`);

      const unresolved = insight.unresolved_items_json as string[] | null;
      if (unresolved?.length)
        lines.push(`Items sin resolver: ${unresolved.join(", ")}`);

      const actions = insight.suggested_actions_json as Array<{ description: string }> | null;
      if (actions?.length)
        lines.push(
          `Acciones sugeridas: ${actions
            .slice(0, 3)
            .map((a) => a.description)
            .join("; ")}`,
        );

      return lines.length > 1 ? lines.join("\n") : "";
    } catch (err) {
      this.logger.warn(`Failed to build conversation context: ${(err as Error).message}`);
      return "";
    }
  }
}
