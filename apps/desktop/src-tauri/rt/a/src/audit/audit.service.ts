import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { FilterAuditDto } from './dto/filter-audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, filters: FilterAuditDto) {
    const {
      entity_type,
      entity_id,
      user_id,
      action,
      from,
      to,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { workspace_id: workspaceId };

    if (entity_type) {
      where.entity_type = { contains: entity_type, mode: 'insensitive' };
    }
    if (entity_id) {
      where.entity_id = { contains: entity_id, mode: 'insensitive' };
    }
    if (user_id) {
      where.user_id = { contains: user_id, mode: 'insensitive' };
    }
    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async log(
    workspaceId: string,
    data: {
      user_id?: string;
      action: string;
      entity_type: string;
      entity_id: string;
      before?: any;
      after?: any;
    },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          workspace_id: workspaceId,
          user_id: data.user_id ?? null,
          action: data.action,
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          before_json: data.before ?? undefined,
          after_json: data.after ?? undefined,
        },
      });
    } catch {
      // Silently ignore audit log errors to not disrupt main flow
    }
  }
}
