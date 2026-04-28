import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const DEFAULT_SLA_HOURS: Record<string, number> = {
  FREE: 24,
  STARTER: 12,
  GROWTH: 4,
  ENTERPRISE: 1,
};

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackFirstResponse(conversationId: string): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { first_response_at: true, workspace_id: true, created_at: true },
    });

    if (!conv || conv.first_response_at) return;

    const ws = await this.prisma.workspace.findUnique({
      where: { id: conv.workspace_id },
      select: { plan: true },
    });

    const targetHours = ws?.plan ? (DEFAULT_SLA_HOURS[ws.plan] ?? 24) : 24;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        first_response_at: new Date(),
        sla_target_hours: targetHours,
      },
    });

    this.logger.log(`First response tracked for conversation ${conversationId}`);
  }

  async trackResolution(conversationId: string): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { resolved_at: true, created_at: true, sla_target_hours: true },
    });

    if (!conv || conv.resolved_at) return;

    const data: any = { resolved_at: new Date() };

    if (conv.created_at && conv.sla_target_hours) {
      const slaDeadline = new Date(conv.created_at.getTime() + conv.sla_target_hours * 3600_000);
      if (new Date() > slaDeadline) {
        data.sla_breached = true;
      }
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data,
    });
  }

  async checkSlaBreaches(workspaceId: string): Promise<void> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });

    const targetHours = ws?.plan ? (DEFAULT_SLA_HOURS[ws.plan] ?? 24) : 24;
    const deadline = new Date(Date.now() - targetHours * 3600_000);

    const breached = await this.prisma.conversation.updateMany({
      where: {
        workspace_id: workspaceId,
        status: { in: ['NEW', 'OPEN', 'PENDING'] },
        sla_breached: false,
        created_at: { lt: deadline },
      },
      data: { sla_breached: true },
    });

    if (breached.count > 0) {
      this.logger.log(`SLA breach: ${breached.count} conversations in workspace ${workspaceId}`);
    }
  }

  async getSlaStats(workspaceId: string) {
    const [total, breached] = await Promise.all([
      this.prisma.conversation.count({ where: { workspace_id: workspaceId } }),
      this.prisma.conversation.count({ where: { workspace_id: workspaceId, sla_breached: true } }),
    ]);

    return {
      total,
      breached,
      breachRate: total > 0 ? ((breached / total) * 100).toFixed(1) + '%' : '0%',
      slaTargets: DEFAULT_SLA_HOURS,
    };
  }
}
