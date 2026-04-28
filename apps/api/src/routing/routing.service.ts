import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates active routing rules for a workspace/channel and returns the
   * matching department_id, or null if no rule fires.
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
  ): Promise<string | null> {
    const rules = await this.prisma.routingRule.findMany({
      where: {
        workspace_id: workspaceId,
        is_active: true,
        OR: [{ channel_id: channelId }, { channel_id: null }],
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
    });

    // Sort so channel-specific rules come before workspace-wide ones
    const sorted = [
      ...rules.filter((r) => r.channel_id === channelId),
      ...rules.filter((r) => r.channel_id === null),
    ];

    const text = messageText.trim().toLowerCase();

    for (const rule of sorted) {
      const pattern = rule.pattern.trim().toLowerCase();
      if (rule.match_type === 'MENU_REPLY') {
        if (text === pattern) return rule.department_id;
      } else {
        if (text.includes(pattern)) return rule.department_id;
      }
    }

    return null;
  }
}
