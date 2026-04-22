import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '../queues.constants';

interface NotificationJobData {
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<any> {
    const {
      workspaceId,
      userId,
      type,
      title,
      body,
      relatedEntityType,
      relatedEntityId,
    } = job.data;

    this.logger.log(
      `Processing notification job ${job.id} for user ${userId} in workspace ${workspaceId}`,
    );

    const notification = await this.prisma.notification.create({
      data: {
        workspace_id: workspaceId,
        user_id: userId,
        type,
        title,
        body,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
      },
    });

    this.logger.log(
      `Notification job ${job.id} completed: notification=${notification.id}, type=${type}`,
    );

    return { notificationId: notification.id };
  }
}
