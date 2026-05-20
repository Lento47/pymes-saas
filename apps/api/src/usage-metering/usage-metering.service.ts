import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class UsageMeteringService {
  private readonly logger = new Logger(UsageMeteringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUsage(workspaceId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [contacts, invoices, automations, users, messages] = await Promise.all([
      this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
      this.prisma.invoice.count({ where: { workspace_id: workspaceId, created_at: { gte: monthStart } } }),
      this.prisma.automationRule.count({ where: { workspace_id: workspaceId } }),
      this.prisma.workspaceUser.count({ where: { workspace_id: workspaceId } }),
      this.prisma.message.count({
        where: { workspace_id: workspaceId, created_at: { gte: monthStart } },
      }),
    ]);

    const storageAgg = await this.prisma.document.aggregate({
      where: { workspace_id: workspaceId },
      _sum: { file_size: true },
    });

    const whatsappMsgs = await this.prisma.message.count({
      where: { workspace_id: workspaceId, created_at: { gte: monthStart }, direction: 'INBOUND' },
    });

    return {
      contacts,
      invoicesThisMonth: invoices,
      automations,
      storageUsedMb: Number(((storageAgg._sum.file_size ?? 0) / (1024 * 1024)).toFixed(1)),
      users,
      messagesThisMonth: messages,
      whatsappMessagesThisMonth: whatsappMsgs,
    };
  }

  async createSnapshot(workspaceId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const usage = await this.getCurrentUsage(workspaceId);
    const storageAgg = await this.prisma.document.aggregate({
      where: { workspace_id: workspaceId },
      _sum: { file_size: true },
    });

    return this.prisma.workspaceUsageSnapshot.create({
      data: {
        workspace: { connect: { id: workspaceId } },
        period_start: monthStart,
        period_end: monthEnd,
        contacts_count: usage.contacts,
        invoices_count: usage.invoicesThisMonth,
        automations_count: usage.automations,
        storage_used_mb: parseFloat(usage.storageUsedMb),
        users_count: usage.users,
        locations_count: 1,
        whatsapp_messages_count: usage.whatsappMessagesThisMonth,
        telegram_messages_count: 0,
        email_messages_count: 0,
        forms_submitted_count: 0,
        api_calls_count: 0,
      },
    });
  }

  async getUsageHistory(workspaceId: string, limit = 6) {
    return this.prisma.workspaceUsageSnapshot.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { period_start: 'desc' },
      take: limit,
    });
  }
}
