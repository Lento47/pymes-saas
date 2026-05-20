import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { FilterConversationsDto } from './dto/filter-conversations.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AutomationsService } from '../automations/automations.service';
import { SlaService } from './sla.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly automationsService: AutomationsService,
    private readonly slaService: SlaService,
  ) {}

  // ── GET /conversations ─────────────────────────────────────────────────────

  async findAll(workspaceId: string, filters: FilterConversationsDto, caller?: { id: string; role: string }) {
    const {
      status, priority, assigned_user_id, contact_id,
      channel_id, channel_type, unassigned, category, q, department_id, page = 1, limit = 20,
    } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { workspace_id: workspaceId };
    if (status)           where.status           = status;
    if (priority)         where.priority         = priority;
    if (assigned_user_id) where.assigned_user_id = assigned_user_id;
    if (unassigned)       where.assigned_user_id = null;
    if (contact_id)       where.contact_id       = contact_id;
    if (channel_id)       where.channel_id       = channel_id;
    if (channel_type)     where.channel          = { type: channel_type };
    if (category)         where.category         = { contains: category, mode: 'insensitive' };
    if (q)                where.subject          = { contains: q, mode: 'insensitive' };
    if (department_id)    where.department_id    = department_id;

    // AGENTs only see conversations belonging to their department(s)
    // TODO(perf): This runs a separate query for department memberships on every
    // findAll call. Consider caching the agent's department_ids in the JWT or
    // prefetching them in a guard/middleware to avoid the extra round-trip.
    if (caller && caller.role === 'AGENT') {
      const memberships = await this.prisma.departmentMember.findMany({
        where: { user_id: caller.id, workspace_id: workspaceId },
        select: { department_id: true },
      });
      if (memberships.length > 0) {
        const deptIds = memberships.map(m => m.department_id);
        where.department_id = { in: deptIds };
      }
      // If AGENT has no department yet, still show all (graceful fallback)
    }

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { last_message_at: 'desc' },
        // Explicit select — avoids querying columns not yet in DB (migration pending)
      select: {
        // Explicit column selection avoids querying WhatsApp window columns not yet in DB
        id: true, workspace_id: true, channel_id: true, contact_id: true,
          subject: true, status: true, priority: true, category: true,
          assigned_user_id: true, last_message_at: true, department_id: true,
          first_response_at: true, resolved_at: true,
          sla_breached: true, sla_target_hours: true,
          created_at: true, updated_at: true,
          contact:       { select: { id: true, full_name: true, company_name: true, email: true } },
          channel:       { select: { id: true, name: true, type: true } },
          assigned_user: { select: { id: true, name: true, avatar_url: true } },
          _count:        { select: { messages: true, tasks: true } },
          messages:      { orderBy: { sent_at: 'desc' }, take: 1, select: { body_text: true, direction: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── POST /conversations ────────────────────────────────────────────────────

  async create(workspaceId: string, dto: CreateConversationDto) {
    // Validar que el canal pertenece al workspace
    const channel = await this.prisma.channel.findFirst({
      where: { id: dto.channel_id, workspace_id: workspaceId },
    });
    if (!channel) throw new NotFoundException('Canal no encontrado en este workspace.');

    const conversation = await this.prisma.conversation.create({
      data: {
        workspace_id:     workspaceId,
        channel_id:       dto.channel_id,
        contact_id:       dto.contact_id,
        subject:          dto.subject,
        status:           'NEW',
        priority:         dto.priority ?? 'MEDIUM',
        category:         dto.category,
        assigned_user_id: dto.assigned_user_id,
      },
      select: {
        id: true, workspace_id: true, channel_id: true, contact_id: true,
        subject: true, status: true, priority: true, category: true,
        assigned_user_id: true, department_id: true,
        channel: { select: { id: true, name: true, type: true } },
        contact: { select: { id: true, full_name: true } },
      },
    });

    await this.automationsService.triggerRules(
      workspaceId,
      'CONVERSATION_CREATED',
      'conversation',
      conversation.id,
    );

    return conversation;
  }

  // ── GET /conversations/:id ─────────────────────────────────────────────────

  async findOne(workspaceId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, workspace_id: workspaceId },
      // Explicit select — avoids querying columns not yet in DB
      select: {
        id: true, workspace_id: true, channel_id: true, contact_id: true,
        subject: true, status: true, priority: true, category: true,
        assigned_user_id: true, last_message_at: true, department_id: true,
        first_response_at: true, resolved_at: true,
        sla_breached: true, sla_target_hours: true,
        created_at: true, updated_at: true,
        channel:       { select: { id: true, name: true, type: true, provider: true } },
        contact:       { select: { id: true, full_name: true, company_name: true, email: true, phone: true } },
        assigned_user: { select: { id: true, name: true, avatar_url: true } },
        tasks: {
          where:   { status: { not: 'ARCHIVED' } },
          select:  { id: true, title: true, status: true, priority: true, due_at: true },
          orderBy: { due_at: 'asc' },
        },
        documents: {
          select:  { id: true, file_name: true, mime_type: true, status: true },
          orderBy: { created_at: 'desc' },
          take:    10,
        },
        _count: { select: { messages: true } },
      },
    });

    if (!conv) throw new NotFoundException('Conversación no encontrada.');
    return conv;
  }

  // ── PATCH /conversations/:id ───────────────────────────────────────────────

  async update(workspaceId: string, id: string, dto: UpdateConversationDto) {
    await this.findOne(workspaceId, id);

    if (dto.contact_id) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.contact_id, workspace_id: workspaceId },
        select: { id: true },
      });
      if (!contact) {
        throw new NotFoundException('Contacto no encontrado.');
      }
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        ...(dto.status           && { status: dto.status }),
        ...(dto.priority         && { priority: dto.priority }),
        ...(dto.category         !== undefined && { category: dto.category }),
        ...(dto.subject          !== undefined && { subject: dto.subject }),
        ...(dto.assigned_user_id !== undefined && { assigned_user_id: dto.assigned_user_id }),
        ...(dto.contact_id !== undefined && { contact_id: dto.contact_id }),
        updated_at: new Date(),
      },
      select: { id: true },
    });

    if (dto.status !== undefined) {
      await this.automationsService.triggerRules(
        workspaceId,
        'CONVERSATION_STATUS_CHANGED',
        'conversation',
        updated.id,
      );
    }

    return updated;
  }

  // ── POST /conversations/:id/assign ─────────────────────────────────────────

  async assign(workspaceId: string, id: string, userId: string) {
    await this.findOne(workspaceId, id);

    // Validar que el usuario pertenece al workspace
    const member = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    });
    if (!member) throw new BadRequestException('Usuario no pertenece al workspace.');

    return this.prisma.conversation.update({
      where: { id },
      data: { assigned_user_id: userId, status: 'OPEN', updated_at: new Date() },
      select: { id: true },
    });
  }

  // ── POST /conversations/:id/resolve ───────────────────────────────────────

  async resolve(workspaceId: string, id: string) {
    const conv = await this.findOne(workspaceId, id);
    if (conv.status === 'RESOLVED') {
      throw new BadRequestException('La conversación ya está resuelta.');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { status: 'RESOLVED', updated_at: new Date() },
      select: { id: true },
    }).then(updated => {
      this.slaService.trackResolution(id).catch(err =>
        this.logger.warn(`SLA resolution error: ${(err as Error).message}`),
      );
      return updated;
    });
  }

  // ── DELETE /conversations/:id ──────────────────────────────────────────────

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);

    return this.prisma.conversation.delete({
      where: { id },
    });
  }

  // ── Helper interno — actualizar last_message_at ────────────────────────────

  async touchLastMessage(workspaceId: string, conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId, workspace_id: workspaceId },
      data:  { last_message_at: new Date(), status: 'OPEN', updated_at: new Date() },
      select: { id: true },
    });
  }
}
