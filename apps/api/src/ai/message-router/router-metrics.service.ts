import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Intent, ModelTier, AgentType } from "./types";

export interface RouterMetrics {
  totalCalls: number;
  repliedCalls: number;
  blockedCalls: number;
  replyRate: number;
  tokensConsumed: number;
  tokensSaved: number;
  byIntent: Record<string, number>;
  byModelTier: Record<string, number>;
  byAgentType: Record<string, number>;
}

@Injectable()
export class RouterMetricsService {
  private readonly logger = new Logger(RouterMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts a daily rollup row for the given workspace + intent + tier combination.
   * `tokensConsumed`: tokens actually spent by LLM calls in this decision.
   * `tokensSaved`: estimated tokens NOT spent because of quick reply / policy block.
   * Never throws.
   */
  async recordCall(
    workspaceId: string,
    intent: Intent,
    modelTier: ModelTier,
    agentType: AgentType | "none",
    replied: boolean,
    blocked: boolean,
    tokensConsumed = 0,
    tokensSaved = 0,
  ): Promise<void> {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await this.prisma.routerMetricsSnapshot.upsert({
        where: {
          workspace_id_date_intent_agent_type_model_tier: {
            workspace_id: workspaceId,
            date: today,
            intent,
            agent_type: agentType,
            model_tier: modelTier,
          },
        },
        update: {
          call_count: { increment: 1 },
          reply_count: { increment: replied ? 1 : 0 },
          blocked_count: { increment: blocked ? 1 : 0 },
          tokens_consumed: { increment: tokensConsumed },
          tokens_saved: { increment: tokensSaved },
        },
        create: {
          workspace_id: workspaceId,
          date: today,
          intent,
          agent_type: agentType,
          model_tier: modelTier,
          call_count: 1,
          reply_count: replied ? 1 : 0,
          blocked_count: blocked ? 1 : 0,
          tokens_consumed: tokensConsumed,
          tokens_saved: tokensSaved,
        },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[router-metrics] record failed workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getMetrics(workspaceId: string, days = 30): Promise<RouterMetrics> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.routerMetricsSnapshot.findMany({
      where: { workspace_id: workspaceId, date: { gte: since } },
    });

    let totalCalls = 0;
    let repliedCalls = 0;
    let blockedCalls = 0;
    let tokensConsumed = 0;
    let tokensSaved = 0;
    const byIntent: Record<string, number> = {};
    const byModelTier: Record<string, number> = {};
    const byAgentType: Record<string, number> = {};

    for (const row of rows) {
      totalCalls += row.call_count;
      repliedCalls += row.reply_count;
      blockedCalls += row.blocked_count;
      tokensConsumed += row.tokens_consumed;
      tokensSaved += row.tokens_saved;
      byIntent[row.intent] = (byIntent[row.intent] ?? 0) + row.call_count;
      byModelTier[row.model_tier] = (byModelTier[row.model_tier] ?? 0) + row.call_count;
      byAgentType[row.agent_type] = (byAgentType[row.agent_type] ?? 0) + row.call_count;
    }

    return {
      totalCalls,
      repliedCalls,
      blockedCalls,
      replyRate: totalCalls > 0 ? repliedCalls / totalCalls : 0,
      tokensConsumed,
      tokensSaved,
      byIntent,
      byModelTier,
      byAgentType,
    };
  }
}
