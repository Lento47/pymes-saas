import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

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
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(data: NotificationJobData): Promise<any> {
    const { workspaceId, userId, type, title, body, relatedEntityType, relatedEntityId } = data;

    this.logger.log(`Processing notification for user ${userId} in workspace ${workspaceId}`);

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

    this.logger.log(`Notification completed: notification=${notification.id}, type=${type}`);

    return { notificationId: notification.id };
  }
}
