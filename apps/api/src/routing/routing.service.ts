import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { Priority } from "@prisma/client";

export interface RoutingResult {
  department_id: string;
  set_priority?: Priority | null;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates active routing rules for a workspace/channel and returns the
   * matching department_id, or null if no rule fires.
   *
   * Routing is intentionally best-effort: inbound messages must never fail
   * just because routing tables, migrations, or Prisma Client generation are
   * temporarily out of sync.
   *
   * Matching precedence:
   *  1. Channel-specific rules before workspace-wide rules (channel_id DESC nulls last)
   *  2. Higher priority value wins within each group
   *  3. MENU_REPLY: exact match; KEYWORD: case-insensitive substring match
   */
  async resolveQueue(
    workspaceId: string,
    channelId: string,
    messageText: string,
  ): Promise<RoutingResult | null> {
    const routingRuleDelegate = this.prisma.routingRule;

    if (!routingRuleDelegate?.findMany) {
      this.logger.warn(
        `Routing skipped: Prisma routingRule delegate is unavailable. workspace=${workspaceId} channel=${channelId}`,
      );
      return null;
    }

    try {
      const rules = await routingRuleDelegate.findMany({
        where: {
          workspace_id: workspaceId,
          is_active: true,
          OR: [{ channel_id: channelId }, { channel_id: null }],
        },
        orderBy: [{ priority: "desc" }, { created_at: "asc" }],
      });

      // Sort so channel-specific rules come before workspace-wide ones
      const sorted = [
        ...rules.filter((r) => r.channel_id === channelId),
        ...rules.filter((r) => r.channel_id === null),
      ];

      const text = messageText.trim().toLowerCase();

      for (const rule of sorted) {
        const pattern = rule.pattern.trim().toLowerCase();
        if (rule.match_type === "MENU_REPLY") {
          if (text === pattern)
            return {
              department_id: rule.department_id,
              set_priority: rule.set_priority as Priority | null | undefined,
            };
        } else {
          if (text.includes(pattern))
            return {
              department_id: rule.department_id,
              set_priority: rule.set_priority as Priority | null | undefined,
            };
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Routing skipped: ${(error as Error).message}. workspace=${workspaceId} channel=${channelId}`,
      );
      return null;
    }
  }
}
