import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /tasks ─────────────────────────────────────────────────────────────

  async findAll(workspaceId: string, filters: FilterTasksDto) {
    const {
      status, priority, source, assigned_user_id,
      contact_id, conversation_id, overdue, q,
      page = 1, limit = 20,
    } = filters;
    const skip = (page - 1) * limit;

    const where: any = { workspace_id: workspaceId };

    if (status)           where.status           = status;
    if (priority)         where.priority         = priority;
    if (source)           where.source           = source;
    if (assigned_user_id) where.assigned_user_id = assigned_user_id;
    if (contact_id)       where.contact_id       = contact_id;
    if (conversation_id)  where.conversation_id  = conversation_id;

    if (overdue === 'true') {
      where.due_at     = { lt: new Date() };
      where.status     = { notIn: ['DONE', 'ARCHIVED'] };
      where.completed_at = null;
    }

    if (q) {
      where.OR = [
        { title:       { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { due_at: 'asc' }, { created_at: 'desc' }],
        include: {
          assigned_user: { select: { id: true, name: true, avatar_url: true } },
          contact:       { select: { id: true, full_name: true, company_name: true } },
          conversation:  { select: { id: true, subject: true, status: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── POST /tasks ────────────────────────────────────────────────────────────

  async create(workspaceId: string, user: AuthUser, dto: CreateTaskDto) {
    // Validar que conversation y contact pertenecen al workspace
    if (dto.conversation_id) {
      const conv = await this.prisma.conversation.findFirst({
        where: { id: dto.conversation_id, workspace_id: workspaceId },
      });
      if (!conv) throw new NotFoundException('Conversación no encontrada.');
    }

    if (dto.contact_id) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.contact_id, workspace_id: workspaceId },
      });
      if (!contact) throw new NotFoundException('Contacto no encontrado.');
    }

    return this.prisma.task.create({
      data: {
        workspace_id:    workspaceId,
        title:           dto.title,
        description:     dto.description,
        status:          'TODO',
        priority:        dto.priority ?? 'MEDIUM',
        source:          dto.source   ?? 'MANUAL',
        assigned_user_id: dto.assigned_user_id,
        conversation_id: dto.conversation_id,
        contact_id:      dto.contact_id,
        due_at:          dto.due_at ? new Date(dto.due_at) : undefined,
      },
      include: {
        assigned_user: { select: { id: true, name: true, avatar_url: true } },
        contact:       { select: { id: true, full_name: true } },
      },
    });
  }

  // ── GET /tasks/:id ─────────────────────────────────────────────────────────

  async findOne(workspaceId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        assigned_user: { select: { id: true, name: true, avatar_url: true } },
        contact:       { select: { id: true, full_name: true, company_name: true, email: true } },
        conversation:  { select: { id: true, subject: true, status: true, channel: { select: { type: true } } } },
      },
    });

    if (!task) throw new NotFoundException('Tarea no encontrada.');
    return task;
  }

  // ── PATCH /tasks/:id ───────────────────────────────────────────────────────

  async update(workspaceId: string, id: string, dto: UpdateTaskDto) {
    await this.findOne(workspaceId, id);

    return this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title            !== undefined && { title: dto.title }),
        ...(dto.description      !== undefined && { description: dto.description }),
        ...(dto.status           && { status: dto.status }),
        ...(dto.priority         && { priority: dto.priority }),
        ...(dto.assigned_user_id !== undefined && { assigned_user_id: dto.assigned_user_id }),
        ...(dto.due_at           !== undefined && { due_at: dto.due_at ? new Date(dto.due_at) : null }),
        updated_at: new Date(),
      },
    });
  }

  // ── POST /tasks/:id/complete ───────────────────────────────────────────────

  async complete(workspaceId: string, id: string) {
    const task = await this.findOne(workspaceId, id);

    if (task.status === 'DONE') {
      throw new BadRequestException('La tarea ya está completada.');
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status:       'DONE',
        completed_at: new Date(),
        updated_at:   new Date(),
      },
    });
  }

  // ── GET /tasks/overdue — resumen de tareas vencidas ───────────────────────

  async getOverdueSummary(workspaceId: string) {
    const now = new Date();
    const tasks = await this.prisma.task.findMany({
      where: {
        workspace_id: workspaceId,
        due_at: { lt: now },
        status: { notIn: ['DONE', 'ARCHIVED'] },
        completed_at: null,
      },
      include: {
        assigned_user: { select: { id: true, name: true } },
      },
      orderBy: { due_at: 'asc' },
    });

    return { total_overdue: tasks.length, tasks };
  }

  // ── DELETE /tasks/:id ──────────────────────────────────────────────────────

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.task.delete({
      where: { id },
    });
  }
}
