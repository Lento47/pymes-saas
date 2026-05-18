import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AssignMemberDto } from './dto/assign-member.dto';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateWorkspaceBillingDto } from './dto/update-workspace-billing.dto';
import {
  BillingEvent,
  BillingInterval,
  BillingProvider,
  UserStatus,
  WorkspacePlan,
  WorkspaceSubscription,
  WorkspaceSubscriptionStatus,
} from '@prisma/client';
import { stringifyJson } from '../common/prisma/json';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeBilling(
    workspace: { id: string; name: string; slug: string; plan: WorkspacePlan; status: string },
    subscription: WorkspaceSubscription | null,
    events: BillingEvent[],
  ) {
    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
        status: workspace.status,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            provider: subscription.provider,
            status: subscription.status,
            plan: subscription.plan,
            billing_interval: subscription.billing_interval,
            provider_customer_id: subscription.provider_customer_id,
            provider_subscription_id: subscription.provider_subscription_id,
            external_reference: subscription.external_reference,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_ends_at: subscription.trial_ends_at,
            notes: subscription.notes,
            metadata_json: subscription.metadata_json,
            created_at: subscription.created_at,
            updated_at: subscription.updated_at,
          }
        : null,
      events: events.map((event) => ({
        id: event.id,
        provider: event.provider,
        source: event.source,
        event_type: event.event_type,
        provider_event_id: event.provider_event_id,
        applied_plan: event.applied_plan,
        processed_at: event.processed_at,
        notes: event.notes,
        created_at: event.created_at,
      })),
    };
  }

  // ── GET /platform/workspaces ──────────────────────────────────────────────

  async listWorkspaces() {
    const workspaces = await this.prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        created_at: true,
        _count: { select: { workspace_users: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return workspaces.map((w) => ({
      ...w,
      member_count: w._count.workspace_users,
    }));
  }

  // ── GET /platform/workspaces/:slug/members ────────────────────────────────

  async listMembers(slug: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    const members = await (this.prisma.workspaceUser as any).findMany({
      where: { workspace_id: workspace.id },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatar_url: true, status: true, is_platform_admin: true },
        },
      },
      orderBy: { created_at: 'asc' },
    }) as any[];

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      is_owner: m.is_owner,
      joined_at: m.created_at,
      user: m.user,
    }));
  }

  // ── GET /platform/workspaces/:slug/billing ───────────────────────────────

  async getWorkspaceBilling(slug: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, plan: true, status: true },
    });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    const [subscription, events] = await Promise.all([
      this.prisma.workspaceSubscription.findFirst({
        where: { workspace_id: workspace.id },
        orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.billingEvent.findMany({
        where: { workspace_id: workspace.id },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    return this.serializeBilling(
      {
        ...workspace,
        plan: workspace.plan as WorkspacePlan,
      },
      subscription,
      events,
    );
  }

  // ── POST /platform/workspaces/:slug/members ───────────────────────────────

  async assignMember(slug: string, dto: AssignMemberDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException(`Usuario con email ${dto.email} no existe. Debe registrarse primero.`);

    const existing = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspace.id, user_id: user.id },
      },
    });
    if (existing) throw new ConflictException('El usuario ya es miembro de este workspace.');

    const membership = await this.prisma.workspaceUser.create({
      data: {
        workspace_id: workspace.id,
        user_id: user.id,
        role: (dto.role ?? 'AGENT') as any,
        is_owner: false,
      },
    });

    return { message: `${dto.email} agregado al workspace ${workspace.name}.`, membership_id: membership.id };
  }

  // ── PATCH /platform/workspaces/:slug/members/:userId/role ─────────────────

  async updateMemberRole(slug: string, userId: string, dto: UpdateMemberRoleDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    const membership = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });
    if (!membership) throw new NotFoundException('Membresía no encontrada.');

    return this.prisma.workspaceUser.update({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
      data: { role: dto.role as any },
    });
  }

  // ── DELETE /platform/workspaces/:slug/members/:userId ─────────────────────

  async removeMember(slug: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    const membership = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });
    if (!membership) throw new NotFoundException('Membresía no encontrada.');
    if (membership.is_owner) throw new ConflictException('No se puede remover al owner del workspace.');

    await this.prisma.workspaceUser.delete({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });

    return { message: 'Acceso revocado.' };
  }

  // ── PATCH /platform/workspaces/:slug/billing ─────────────────────────────

  async updateWorkspaceBilling(
    slug: string,
    actorUserId: string,
    dto: UpdateWorkspaceBillingDto,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, plan: true, status: true },
    });
    if (!workspace) throw new NotFoundException('Workspace no encontrado.');

    const currentSubscription = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspace.id },
      orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
    });

    const effectivePlan = dto.plan ?? currentSubscription?.plan ?? workspace.plan;
    const effectiveStatus =
      dto.status ?? currentSubscription?.status ?? WorkspaceSubscriptionStatus.MANUAL;
    const effectiveProvider =
      dto.provider ?? currentSubscription?.provider ?? BillingProvider.MANUAL;
    const effectiveInterval =
      dto.billing_interval ?? currentSubscription?.billing_interval ?? BillingInterval.MONTHLY;

    const nextSubscriptionData = {
      provider: effectiveProvider,
      status: effectiveStatus,
      plan: effectivePlan,
      billing_interval: effectiveInterval,
      provider_customer_id:
        dto.provider_customer_id ?? currentSubscription?.provider_customer_id ?? null,
      provider_subscription_id:
        dto.provider_subscription_id ?? currentSubscription?.provider_subscription_id ?? null,
      external_reference:
        dto.external_reference ?? currentSubscription?.external_reference ?? null,
      current_period_start: dto.current_period_start
        ? new Date(dto.current_period_start)
        : currentSubscription?.current_period_start ?? null,
      current_period_end: dto.current_period_end
        ? new Date(dto.current_period_end)
        : currentSubscription?.current_period_end ?? null,
      trial_ends_at: dto.trial_ends_at
        ? new Date(dto.trial_ends_at)
        : currentSubscription?.trial_ends_at ?? null,
      cancel_at_period_end:
        dto.cancel_at_period_end ?? currentSubscription?.cancel_at_period_end ?? false,
      notes: dto.notes ?? currentSubscription?.notes ?? null,
      metadata_json:
        dto.metadata_json !== undefined
          ? stringifyJson(dto.metadata_json)
          : currentSubscription?.metadata_json ?? null,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const subscription = currentSubscription
        ? await tx.workspaceSubscription.update({
            where: { id: currentSubscription.id },
            data: nextSubscriptionData as any,
          })
        : await tx.workspaceSubscription.create({
            data: {
              workspace: { connect: { id: workspace.id } },
              ...nextSubscriptionData,
            } as any,
          });

      if (workspace.plan !== effectivePlan) {
        await tx.workspace.update({
          where: { id: workspace.id },
          data: { plan: effectivePlan as any },
        });
      }

      await tx.billingEvent.create({
        data: {
          workspace_id: workspace.id,
          subscription_id: subscription.id,
          provider: effectiveProvider,
          source: dto.provider ? 'BILLING_UPDATE' : 'MANUAL',
          event_type: dto.event_type ?? 'MANUAL_PLAN_UPDATE',
          actor_user_id: actorUserId,
          applied_plan: effectivePlan as any,
          payload_json:
            dto.payload_json || dto.metadata_json
              ? stringifyJson(dto.payload_json ?? dto.metadata_json ?? null)
              : null,
          processed_at: new Date(),
          notes:
            dto.notes ??
            `Plan efectivo actualizado a ${effectivePlan} con estado ${effectiveStatus}.`,
        },
      });

      const refreshedWorkspace = await tx.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
        select: { id: true, name: true, slug: true, plan: true, status: true },
      });
      const events = await tx.billingEvent.findMany({
        where: { workspace_id: workspace.id },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      return this.serializeBilling(
        {
          ...refreshedWorkspace,
          plan: refreshedWorkspace.plan as WorkspacePlan,
        },
        subscription,
        events,
      );
    });

    return result;
  }

  // ── GET /platform/users?email=... ────────────────────────────────────────

  async searchUsers(email?: string) {
    return (this.prisma.user as any).findMany({
      where: email ? { email: { contains: email, mode: 'insensitive' } } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        status: true,
        is_platform_admin: true,
        created_at: true,
        workspace_users: {
          include: {
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      take: 50,
      orderBy: { created_at: 'desc' },
    });
  }

  async createUser(dto: CreatePlatformUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado.');

    const password_hash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password_hash,
        status: UserStatus.ACTIVE,
        is_platform_admin: dto.is_platform_admin ?? false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        status: true,
        is_platform_admin: true,
        created_at: true,
        workspace_users: {
          include: {
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  }

  async updateUserPassword(userId: string, password: string) {
    await this.ensureUserExists(userId);
    const password_hash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash, status: UserStatus.ACTIVE },
    });
    await this.prisma.refreshToken.deleteMany({ where: { user_id: userId } });
    return { message: 'Contraseña actualizada y sesiones revocadas.' };
  }

  async resetUserPassword(userId: string) {
    const user = await this.ensureUserExists(userId);
    const temporaryPassword = this.generateTemporaryPassword();
    const password_hash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash, status: UserStatus.ACTIVE },
    });
    await this.prisma.refreshToken.deleteMany({ where: { user_id: userId } });

    return {
      message: `Contraseña temporal generada para ${user.email}.`,
      temporary_password: temporaryPassword,
    };
  }

  async updateUserStatus(userId: string, actorUserId: string, status: UserStatus) {
    if (userId === actorUserId && status !== UserStatus.ACTIVE) {
      throw new BadRequestException('No podés bloquear o desactivar tu propio usuario.');
    }

    await this.ensureUserExists(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        status: true,
        is_platform_admin: true,
        created_at: true,
        workspace_users: {
          include: {
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (status !== UserStatus.ACTIVE) {
      await this.prisma.refreshToken.deleteMany({ where: { user_id: userId } });
    }

    return updated;
  }

  async togglePlatformAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, is_platform_admin: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    return this.prisma.user.update({
      where: { id: userId },
      data: { is_platform_admin: !user.is_platform_admin },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        status: true,
        is_platform_admin: true,
        created_at: true,
        workspace_users: {
          include: {
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  }

  async deleteUser(userId: string, actorUserId: string) {
    if (userId === actorUserId) {
      throw new BadRequestException('No podés eliminar tu propio usuario.');
    }

    const user = await this.ensureUserExists(userId);
    const ownerMembership = await this.prisma.workspaceUser.findFirst({
      where: { user_id: userId, is_owner: true },
      include: { workspace: { select: { name: true, slug: true } } },
    });
    if (ownerMembership) {
      throw new ConflictException(
        `No se puede eliminar porque es owner de ${ownerMembership.workspace.name} (${ownerMembership.workspace.slug}). Transferí ownership primero.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.updateMany({
        where: { assigned_user_id: userId },
        data: { assigned_user_id: null },
      });
      await tx.message.updateMany({
        where: { sender_user_id: userId },
        data: { sender_user_id: null },
      });
      await tx.task.updateMany({
        where: { assigned_user_id: userId },
        data: { assigned_user_id: null },
      });
      await tx.document.updateMany({
        where: { uploaded_by_user_id: userId },
        data: { uploaded_by_user_id: null },
      });
      await tx.automationRule.updateMany({
        where: { created_by_user_id: userId },
        data: { created_by_user_id: null },
      });
      await tx.auditLog.updateMany({
        where: { user_id: userId },
        data: { user_id: null },
      });
      await tx.deal.updateMany({
        where: { assigned_user_id: userId },
        data: { assigned_user_id: null },
      });
      await tx.user.delete({ where: { id: userId } });
    });

    return { message: `Usuario ${user.email} eliminado.` };
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  private generateTemporaryPassword() {
    return `${randomBytes(9).toString('base64url')}aA1!`;
  }
}
