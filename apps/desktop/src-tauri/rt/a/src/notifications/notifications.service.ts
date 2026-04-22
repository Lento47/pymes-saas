import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { FilterNotificationsDto } from './dto/filter-notifications.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { EventsGateway } from '../gateways/events.gateway';

export interface CreateNotificationData {
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) { }

  async findAll(workspaceId: string, userId: string, filters: FilterNotificationsDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { workspace_id: workspaceId, user_id: userId };

    if (filters.read !== undefined) {
      where.read_at = filters.read === 'true' ? { not: null } : null;
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUnreadCount(workspaceId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        read_at: null,
      },
    });
    return { count };
  }

  async markRead(workspaceId: string, userId: string, dto: MarkReadDto) {
    if (dto.ids && dto.ids.length > 0) {
      await this.prisma.notification.updateMany({
        where: {
          id: { in: dto.ids },
          workspace_id: workspaceId,
          user_id: userId,
        },
        data: { read_at: new Date() },
      });
      return { message: `Marked ${dto.ids.length} notification(s) as read`, count: dto.ids.length };
    }

    const result = await this.prisma.notification.updateMany({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        read_at: null,
      },
      data: { read_at: new Date() },
    });

    return { message: 'Marked all unread notifications as read', count: result.count };
  }

  async create(workspaceId: string, data: CreateNotificationData) {
    const notification = await this.prisma.notification.create({
      data: {
        workspace_id: workspaceId,
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        body: data.body,
        related_entity_type: data.related_entity_type,
        related_entity_id: data.related_entity_id,
      },
    });

    // Emitir en tiempo real al usuario
    this.events.emitNotification(data.user_id, notification);

    return notification;
  }

  async deleteOld(workspaceId: string) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await this.prisma.notification.deleteMany({
      where: {
        workspace_id: workspaceId,
        read_at: { not: null, lt: cutoff } as any,
        created_at: { lt: cutoff },
      },
    });

    return { message: `Deleted ${result.count} old notification(s)`, count: result.count };
  }
}
