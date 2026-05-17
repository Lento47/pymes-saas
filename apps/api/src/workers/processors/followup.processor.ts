import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class FollowupProcessor {
  private readonly logger = new Logger(FollowupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 * * * *') // cada hora
  async checkOverdueTasks(): Promise<void> {
    this.logger.log('Running checkOverdueTasks cron job');

    const now = new Date();

    const overdueTasks = await this.prisma.task.findMany({
      where: {
        due_at: { lt: now },
        status: { notIn: ['DONE', 'ARCHIVED'] },
        completed_at: null,
      },
      take: 100,
    });

    this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

    for (const task of overdueTasks) {
      if (!task.assigned_user_id) continue;

      try {
        await this.notificationsService.create(task.workspace_id, {
          user_id: task.assigned_user_id,
          type: 'task_overdue',
          title: 'Tarea vencida',
          body: `La tarea "${task.title}" venció el ${task.due_at!.toLocaleDateString('es-CR')}`,
          related_entity_type: 'task',
          related_entity_id: task.id,
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to create overdue notification for task ${task.id}: ${error?.message}`,
          error?.stack,
        );
      }
    }

    this.logger.log('checkOverdueTasks cron job finished');
  }

  @Cron('0 */4 * * *') // cada 4 horas
  async checkUnansweredConversations(): Promise<void> {
    this.logger.log('Running checkUnansweredConversations cron job');

    const threshold = new Date(Date.now() - 4 * 60 * 60 * 1000); // hace 4 horas

    const conversations = await this.prisma.conversation.findMany({
      where: {
        status: { in: ['NEW', 'OPEN'] },
        last_message_at: { lt: threshold },
        assigned_user_id: { not: null },
      },
      take: 50,
    });

    this.logger.log(`Found ${conversations.length} unanswered conversations`);

    for (const conv of conversations) {
      if (!conv.assigned_user_id) continue;

      try {
        await this.notificationsService.create(conv.workspace_id, {
          user_id: conv.assigned_user_id,
          type: 'conversation_no_reply',
          title: 'Conversación sin respuesta',
          body: 'La conversación lleva más de 4 horas sin respuesta.',
          related_entity_type: 'conversation',
          related_entity_id: conv.id,
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to create no-reply notification for conversation ${conv.id}: ${error?.message}`,
          error?.stack,
        );
      }
    }

    this.logger.log('checkUnansweredConversations cron job finished');
  }

  @Cron('0 3 * * *') // diario a las 3 AM UTC
  async cleanupInactiveWorkspaces(): Promise<void> {
    this.logger.log('Running cleanupInactiveWorkspaces cron job');

    const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const expired = await this.prisma.workspace.findMany({
      where: {
        status: 'ACTIVE',
        plan: 'FREE',
        updated_at: { lt: threshold },
      },
      select: { id: true, name: true, slug: true },
      take: 50,
    });

    this.logger.log(`Found ${expired.length} inactive workspaces to clean up`);

    for (const ws of expired) {
      try {
        await this.prisma.workspace.update({
          where: { id: ws.id },
          data: {
            status: 'DELETED',
            slug: `${ws.slug}-inactive-${Date.now()}`,
          },
        });
        this.logger.log(`Auto-deleted inactive workspace: ${ws.name} (${ws.slug})`);
      } catch (err) {
        this.logger.error(`Failed to delete workspace ${ws.id}: ${err?.message}`);
      }
    }

    this.logger.log('cleanupInactiveWorkspaces cron job finished');
  }
}
