import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private serializeWorkspace<T extends { settings_json?: any | null }>(workspace: T) {
    const settings =
      workspace.settings_json && typeof workspace.settings_json === 'object'
        ? (workspace.settings_json as Record<string, any>)
        : {};

    return {
      ...workspace,
      ai_message_finance_opt_in: settings.ai_message_finance_opt_in === true,
      ai_provider: settings.ai_provider ?? null,
      ai_model: settings.ai_model ?? null,
      // Never expose encrypted key to frontend
    };
  }

  // ── GET /workspaces/current ────────────────────────────────────────────────

  async getCurrent(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        country_code: true,
        timezone: true,
        locale: true,
        status: true,
        plan: true,
        settings_json: true,
        created_at: true,
        updated_at: true,
      },
    });

    return this.serializeWorkspace(workspace);
  }

  // ── PATCH /workspaces/current ─────────────────────────────────────────────

  async updateCurrent(workspaceId: string, dto: UpdateWorkspaceDto) {
    const { ai_message_finance_opt_in, ai_provider, ai_api_key, ai_model, ...rest } = dto;

    const currentWorkspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const currentSettings =
      currentWorkspace.settings_json &&
      typeof currentWorkspace.settings_json === 'object'
        ? (currentWorkspace.settings_json as Record<string, any>)
        : {};

    const nextSettings = { ...currentSettings };
    if (ai_message_finance_opt_in !== undefined) nextSettings.ai_message_finance_opt_in = ai_message_finance_opt_in;
    if (ai_provider !== undefined) nextSettings.ai_provider = ai_provider;
    if (ai_model !== undefined) nextSettings.ai_model = ai_model;
    if (ai_api_key) nextSettings.ai_api_key_enc = this.crypto.encrypt(ai_api_key);

    const settingsChanged = ai_message_finance_opt_in !== undefined || ai_provider !== undefined || ai_model !== undefined || !!ai_api_key;

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...rest,
        ...(settingsChanged ? { settings_json: nextSettings } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        country_code: true,
        timezone: true,
        locale: true,
        status: true,
        plan: true,
        settings_json: true,
        created_at: true,
        updated_at: true,
      },
    });

    return this.serializeWorkspace(workspace);
  }

  async getAiFinanceMessageConsent(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const settings =
      workspace.settings_json && typeof workspace.settings_json === 'object'
        ? (workspace.settings_json as Record<string, any>)
        : {};

    return settings.ai_message_finance_opt_in === true;
  }

  // ── GET /workspaces/current/stats ─────────────────────────────────────────

  async getStats(workspaceId: string) {
    const [contacts, conversations, tasks, documents, automations, members] = await Promise.all([
      this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
      this.prisma.conversation.count({ where: { workspace_id: workspaceId } }),
      this.prisma.task.count({ where: { workspace_id: workspaceId } }),
      this.prisma.document.count({ where: { workspace_id: workspaceId } }),
      this.prisma.automationRule.count({ where: { workspace_id: workspaceId } }),
      this.prisma.workspaceUser.count({ where: { workspace_id: workspaceId } }),
    ]);

    const activeConversations = await this.prisma.conversation.count({
      where: { workspace_id: workspaceId, status: { in: ['NEW', 'OPEN'] } },
    });

    const pendingTasks = await this.prisma.task.count({
      where: { workspace_id: workspaceId, status: { in: ['TODO', 'IN_PROGRESS'] } },
    });

    const totalDocumentSize = await this.prisma.document.aggregate({
      where: { workspace_id: workspaceId },
      _sum: { file_size: true },
    });

    return {
      contacts,
      conversations,
      activeConversations,
      tasks,
      pendingTasks,
      documents,
      documentStorageBytes: totalDocumentSize._sum.file_size ?? 0,
      automations,
      members,
    };
  }

  // ── GET /workspaces/current/stats/today ────────────────────────────────────

  async getTodayStats(workspaceId: string) {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [new_conversations, received_messages, created_tasks, uploaded_documents] = await Promise.all([
      this.prisma.conversation.count({
        where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
      }),
      this.prisma.message.count({
        where: {
          workspace_id: workspaceId,
          direction: 'INBOUND',
          created_at: { gte: startOfToday },
        },
      }),
      this.prisma.task.count({
        where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
      }),
      this.prisma.document.count({
        where: { workspace_id: workspaceId, created_at: { gte: startOfToday } },
      }),
    ]);

    return { new_conversations, received_messages, created_tasks, uploaded_documents };
  }

  // ── GET /workspaces/current/export ────────────────────────────────────────

  async exportData(workspaceId: string, type: string) {
    if (type === 'contacts') {
      return this.prisma.contact.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, full_name: true, email: true, phone: true, type: true, company_name: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });
    }
    if (type === 'tasks') {
      return this.prisma.task.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, title: true, status: true, priority: true, due_at: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });
    }
    if (type === 'conversations') {
      return this.prisma.conversation.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, subject: true, status: true, priority: true, category: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });
    }
    throw new Error('Invalid export type. Use: contacts | tasks | conversations');
  }

  // ── GET /workspaces/current/members ───────────────────────────────────────

  async getMembers(workspaceId: string) {
    const members = await this.prisma.workspaceUser.findMany({
      where: { workspace_id: workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar_url: true,
            status: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      is_owner: m.is_owner,
      joined_at: m.created_at,
      user: m.user,
    }));
  }

  // ── POST /workspaces/current/members/invite ───────────────────────────────
  // Flujo simplificado: si el email ya existe en users, se agrega directo.
  // En producción: enviar email con token firmado y redirigir a /auth/accept-invite.

  async inviteUser(
    workspaceId: string,
    requestingUser: AuthUser,
    dto: InviteUserDto,
  ) {
    // Solo ADMIN u OWNER pueden invitar
    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Solo ADMIN u OWNER pueden invitar usuarios.');
    }

    // No se puede invitar OWNERs adicionales
    if (dto.role === 'OWNER') {
      throw new BadRequestException(
        'No se puede invitar con rol OWNER. Transfiere la propiedad explícitamente.',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Crear usuario en estado INVITED — recibirá email para setear contraseña
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.email.split('@')[0],
          status: 'INVITED',
        },
      });
    }

    const existing = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: user.id },
      },
    });
    if (existing) {
      throw new ConflictException('El usuario ya es miembro de este workspace.');
    }

    const membership = await this.prisma.workspaceUser.create({
      data: {
        workspace_id: workspaceId,
        user_id: user.id,
        role: dto.role,
        is_owner: false,
      },
    });

    // TODO: enviar email de invitación con link firmado

    return {
      message: `Invitación enviada a ${dto.email}`,
      membership_id: membership.id,
    };
  }

  // ── PATCH /workspaces/current/members/:userId/role ────────────────────────

  async changeMemberRole(
    workspaceId: string,
    requestingUser: AuthUser,
    targetUserId: string,
    dto: ChangeMemberRoleDto,
  ) {
    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Sin permisos para cambiar roles.');
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });
    if (!membership) throw new NotFoundException('Miembro no encontrado.');

    if (membership.is_owner) {
      throw new ForbiddenException(
        'No se puede cambiar el rol del owner. Transfiere la propiedad primero.',
      );
    }

    if (dto.role === 'OWNER') {
      throw new BadRequestException('Usa la ruta de transferencia de propiedad.');
    }

    return this.prisma.workspaceUser.update({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
      data: { role: dto.role },
    });
  }

  // ── DELETE /workspaces/current/members/:userId ────────────────────────────

  async removeMember(
    workspaceId: string,
    requestingUser: AuthUser,
    targetUserId: string,
  ) {
    if (targetUserId === requestingUser.id) {
      throw new BadRequestException('No puedes removerte a ti mismo.');
    }

    if (!['ADMIN', 'OWNER'].includes(requestingUser.role)) {
      throw new ForbiddenException('Sin permisos para remover miembros.');
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });
    if (!membership) throw new NotFoundException('Miembro no encontrado.');
    if (membership.is_owner) {
      throw new ForbiddenException('No se puede remover al owner.');
    }

    await this.prisma.workspaceUser.delete({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: targetUserId },
      },
    });

    return { message: 'Miembro removido del workspace.' };
  }
}
