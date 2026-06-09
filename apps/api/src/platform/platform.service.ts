import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AssignMemberDto } from "./dto/assign-member.dto";
import { CreatePlatformUserDto } from "./dto/create-platform-user.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
import { UpdateWorkspaceBillingDto } from "./dto/update-workspace-billing.dto";
import { UpdateWorkspaceFeaturesDto } from "./dto/update-workspace-features.dto";
import {
  BillingEvent,
  BillingInterval,
  BillingProvider,
  UserStatus,
  WorkspacePlan,
  WorkspaceSubscription,
  WorkspaceSubscriptionStatus,
} from "@prisma/client";
import { FeaturesService } from "../features/features.service";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { AuditService } from "../audit/audit.service";
import { stringifyJson } from "../common/prisma/json";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";

const EMPRENDE_ELIGIBLE_PROFILE = "EMPRENDE_ELIGIBLE";
const VALID_BETA_PROFILES = [
  "BETA_LIGHT",
  "BETA_CONVERSATIONS",
  "BETA_OPERATIONS",
  EMPRENDE_ELIGIBLE_PROFILE,
] as const;

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeaturesService,
    private readonly planLimits: PlanLimitsService,
    private readonly audit: AuditService,
  ) {}

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
        profile: true,
        beta_profile: true,
        status: true,
        created_at: true,
        _count: { select: { workspace_users: true } },
        business_profile: { select: { categories: true, team_size: true } },
        subscriptions: {
          select: { plan: true, status: true, provider: true, updated_at: true },
          orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
          take: 1,
        },
      },
      orderBy: { created_at: "desc" },
    });

    return workspaces.map((w) => ({
      ...w,
      subscription: w.subscriptions[0] ?? null,
      member_count: w._count.workspace_users,
    }));
  }

  // ── GET /platform/workspaces/:slug/members ────────────────────────────────

  async listMembers(slug: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const members = await this.prisma.workspaceUser.findMany({
      where: { workspace_id: workspace.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar_url: true,
            status: true,
            is_platform_admin: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    });

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
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const [subscription, events] = await Promise.all([
      this.prisma.workspaceSubscription.findFirst({
        where: { workspace_id: workspace.id },
        orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
      }),
      this.prisma.billingEvent.findMany({
        where: { workspace_id: workspace.id },
        orderBy: { created_at: "desc" },
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
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user)
      throw new NotFoundException(
        `Usuario con email ${dto.email} no existe. Debe registrarse primero.`,
      );

    const existing = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspace.id, user_id: user.id },
      },
    });
    if (existing) throw new ConflictException("El usuario ya es miembro de este workspace.");

    const membership = await this.prisma.workspaceUser.create({
      data: {
        workspace_id: workspace.id,
        user_id: user.id,
        role: dto.role ?? "AGENT",
        is_owner: false,
      },
    });

    return {
      message: `${dto.email} agregado al workspace ${workspace.name}.`,
      membership_id: membership.id,
    };
  }

  // ── PATCH /platform/workspaces/:slug/members/:userId/role ─────────────────

  async updateMemberRole(slug: string, userId: string, dto: UpdateMemberRoleDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const membership = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });
    if (!membership) throw new NotFoundException("Membresía no encontrada.");

    return this.prisma.workspaceUser.update({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
      data: { role: dto.role },
    });
  }

  // ── DELETE /platform/workspaces/:slug/members/:userId ─────────────────────

  async removeMember(slug: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const membership = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });
    if (!membership) throw new NotFoundException("Membresía no encontrada.");
    if (membership.is_owner)
      throw new ConflictException("No se puede remover al owner del workspace.");

    await this.prisma.workspaceUser.delete({
      where: { workspace_id_user_id: { workspace_id: workspace.id, user_id: userId } },
    });

    return { message: "Acceso revocado." };
  }

  // ── PATCH /platform/workspaces/:slug/billing ─────────────────────────────

  async updateWorkspaceBilling(slug: string, actorUserId: string, dto: UpdateWorkspaceBillingDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, plan: true, status: true },
    });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const currentSubscription = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspace.id },
      orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
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
      external_reference: dto.external_reference ?? currentSubscription?.external_reference ?? null,
      current_period_start: dto.current_period_start
        ? new Date(dto.current_period_start)
        : (currentSubscription?.current_period_start ?? null),
      current_period_end: dto.current_period_end
        ? new Date(dto.current_period_end)
        : (currentSubscription?.current_period_end ?? null),
      trial_ends_at: dto.trial_ends_at
        ? new Date(dto.trial_ends_at)
        : (currentSubscription?.trial_ends_at ?? null),
      cancel_at_period_end:
        dto.cancel_at_period_end ?? currentSubscription?.cancel_at_period_end ?? false,
      notes: dto.notes ?? currentSubscription?.notes ?? null,
      metadata_json:
        dto.metadata_json !== undefined
          ? stringifyJson(dto.metadata_json)
          : (currentSubscription?.metadata_json ?? null),
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const subscription = currentSubscription
        ? await tx.workspaceSubscription.update({
            where: { id: currentSubscription.id },
            data: nextSubscriptionData,
          })
        : await tx.workspaceSubscription.create({
            data: {
              workspace: { connect: { id: workspace.id } },
              ...nextSubscriptionData,
            },
          });

      if (workspace.plan !== effectivePlan) {
        await tx.workspace.update({
          where: { id: workspace.id },
          data: { plan: effectivePlan },
        });
      }

      await tx.billingEvent.create({
        data: {
          workspace_id: workspace.id,
          subscription_id: subscription.id,
          provider: effectiveProvider,
          source: dto.provider ? "BILLING_UPDATE" : "MANUAL",
          event_type: dto.event_type ?? "MANUAL_PLAN_UPDATE",
          actor_user_id: actorUserId,
          applied_plan: effectivePlan,
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
        orderBy: { created_at: "desc" },
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
    return this.prisma.user.findMany({
      where: email ? { email: { contains: email, mode: "insensitive" } } : undefined,
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
      orderBy: { created_at: "desc" },
    });
  }

  async createUser(dto: CreatePlatformUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("El email ya está registrado.");

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
    return { message: "Contraseña actualizada y sesiones revocadas." };
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
      throw new BadRequestException("No podés bloquear o desactivar tu propio usuario.");
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
    if (!user) throw new NotFoundException("Usuario no encontrado.");

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
      throw new BadRequestException("No podés eliminar tu propio usuario.");
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

  async deleteWorkspace(slug: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true, name: true, status: true },
    });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: { status: "DELETED", slug: `${slug}-deleted-${Date.now()}` },
    });

    return { message: `Workspace "${workspace.name}" marcado como eliminado.` };
  }

  // ── GET /platform/workspaces/:slug/features ─────────────────────────────

  async getWorkspaceFeatures(slug: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true, plan: true, beta_profile: true, features_json: true, limits_json: true },
    });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const effective = await this.features.getEffectiveFeatures(workspace.id);
    return {
      workspace_id: workspace.id,
      plan: effective.plan,
      beta_profile: effective.beta_profile,
      features: effective.features,
      limits: effective.limits,
      raw_overrides: {
        features_json: workspace.features_json,
        limits_json: workspace.limits_json,
      },
    };
  }

  // ── PATCH /platform/workspaces/:slug/features ────────────────────────────

  async updateWorkspaceFeatures(
    slug: string,
    actorUserId: string,
    dto: UpdateWorkspaceFeaturesDto,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true, plan: true, beta_profile: true, features_json: true, limits_json: true },
    });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const before = {
      plan: workspace.plan,
      beta_profile: workspace.beta_profile,
      features: workspace.features_json,
      limits: workspace.limits_json,
    };

    const updateData: Record<string, any> = {};
    if (dto.plan !== undefined) {
      const validPlans = Object.values(WorkspacePlan) as string[];
      if (!validPlans.includes(dto.plan)) {
        throw new BadRequestException(`Plan inválido. Debe ser: ${validPlans.join(", ")}.`);
      }
      updateData.plan = dto.plan;
    }
    if (dto.beta_profile !== undefined) {
      const betaProfile = dto.beta_profile || null;
      if (betaProfile && !(VALID_BETA_PROFILES as unknown as string[]).includes(betaProfile)) {
        throw new BadRequestException(
          `Perfil comercial inválido. Debe ser: ${VALID_BETA_PROFILES.join(", ")}.`,
        );
      }
      updateData.beta_profile = betaProfile;
    }
    if (dto.features !== undefined) updateData.features_json = dto.features;
    if (dto.limits !== undefined) updateData.limits_json = dto.limits;

    const updated = await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: updateData,
      select: { id: true, plan: true, beta_profile: true, features_json: true, limits_json: true },
    });

    await this.audit.log(workspace.id, {
      user_id: actorUserId,
      action: "workspace.features.updated",
      entity_type: "workspace",
      entity_id: workspace.id,
      before,
      after: {
        plan: updated.plan,
        beta_profile: updated.beta_profile,
        features: updated.features_json,
        limits: updated.limits_json,
        reason: dto.reason ?? null,
      },
    });

    const effective = await this.features.getEffectiveFeatures(workspace.id);
    return {
      workspace_id: workspace.id,
      plan: effective.plan,
      beta_profile: effective.beta_profile,
      features: effective.features,
      limits: effective.limits,
      raw_overrides: {
        features_json: updated.features_json,
        limits_json: updated.limits_json,
      },
    };
  }

  // ── GET /platform/plan-limits ────────────────────────────────────────────

  async getAllPlanLimits() {
    return this.planLimits.getAllPlanLimits();
  }

  // ── PUT /platform/plan-limits ─────────────────────────────────────────────

  async updatePlanLimits(
    dto: { plan: string; resource: string; value: number }[],
    actorUserId: string,
  ) {
    for (const item of dto) {
      await this.planLimits.setPlanLimitOverride(item.plan, item.resource, item.value);
    }
    return this.planLimits.getAllPlanLimits();
  }

  // ── GET /platform/stats ────────────────────────────────────────────────────

  async getStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalWorkspaces,
      totalUsers,
      activeUsers,
      totalConversations,
      totalInvoices,
      profiledWorkspaces,
      allProfiles,
      workspacesLast12Months,
    ] = await Promise.all([
      this.prisma.workspace.count({ where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { status: "ACTIVE", updated_at: { gte: thirtyDaysAgo } } }),
      this.prisma.conversation.count(),
      this.prisma.invoice.count(),
      this.prisma.workspaceBusinessProfile.count(),
      this.prisma.workspaceBusinessProfile.findMany({
        select: { categories: true, team_size: true },
      }),
      this.prisma.workspace.findMany({
        where: {
          status: "ACTIVE",
          created_at: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        },
        select: { created_at: true },
        orderBy: { created_at: "asc" },
      }),
    ]);

    // Category distribution
    const categoryMap: Record<string, number> = {};
    for (const p of allProfiles) {
      for (const cat of p.categories) {
        categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
      }
    }
    const categoriesDistribution = Object.entries(categoryMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Team size distribution
    const teamSizeMap: Record<string, number> = {};
    for (const p of allProfiles) {
      teamSizeMap[p.team_size] = (teamSizeMap[p.team_size] ?? 0) + 1;
    }
    const teamSizeDistribution = Object.entries(teamSizeMap).map(([team_size, count]) => ({
      team_size,
      count,
    }));

    // Registrations by month (last 12 months)
    const monthMap: Record<string, number> = {};
    for (const ws of workspacesLast12Months) {
      const key = ws.created_at.toISOString().slice(0, 7); // "YYYY-MM"
      monthMap[key] = (monthMap[key] ?? 0) + 1;
    }
    const registrationsByMonth = Object.entries(monthMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Usage averages by category — join profiles with usage snapshots
    const profilesWithSnapshots = await this.prisma.workspaceBusinessProfile.findMany({
      select: {
        categories: true,
        workspace: {
          select: {
            usage_snapshots: {
              orderBy: { period_start: "desc" },
              take: 1,
              select: { contacts_count: true, invoices_count: true },
            },
            _count: { select: { conversations: true } },
          },
        },
      },
    });

    const categoryUsage: Record<
      string,
      { contacts: number[]; conversations: number[]; invoices: number[] }
    > = {};
    for (const p of profilesWithSnapshots) {
      const snap = p.workspace.usage_snapshots[0];
      const contacts = snap?.contacts_count ?? 0;
      const conversations = p.workspace._count.conversations;
      const invoices = snap?.invoices_count ?? 0;
      for (const cat of p.categories) {
        if (!categoryUsage[cat])
          categoryUsage[cat] = { contacts: [], conversations: [], invoices: [] };
        categoryUsage[cat].contacts.push(contacts);
        categoryUsage[cat].conversations.push(conversations);
        categoryUsage[cat].invoices.push(invoices);
      }
    }

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0;
    const usageByCategory = Object.entries(categoryUsage).map(([category, data]) => ({
      category,
      avg_contacts: avg(data.contacts),
      avg_conversations: avg(data.conversations),
      avg_invoices: avg(data.invoices),
    }));

    return {
      totalWorkspaces,
      totalUsers,
      activeUsers,
      totalConversations,
      totalInvoices,
      profiledWorkspaces,
      categoriesDistribution,
      teamSizeDistribution,
      registrationsByMonth,
      usageByCategory,
    };
  }

  // ── GET /platform/workspaces/:slug ─────────────────────────────────────────

  async getWorkspaceBySlug(slug: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        profile: true,
        beta_profile: true,
        status: true,
        timezone: true,
        locale: true,
        created_at: true,
        _count: { select: { workspace_users: true, conversations: true, invoices: true } },
      },
    });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    return {
      ...workspace,
      member_count: workspace._count.workspace_users,
      conversation_count: workspace._count.conversations,
      invoice_count: workspace._count.invoices,
    };
  }

  // ── PATCH /platform/workspaces/:slug/profile ───────────────────────────

  async updateWorkspaceProfile(slug: string, profile: string, actorUserId: string) {
    const validProfiles = ["emprende", "business", "enterprise"];
    if (!validProfiles.includes(profile)) {
      throw new BadRequestException(
        `Perfil inválido. Debe ser: ${validProfiles.join(", ")}.`,
      );
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true, name: true, profile: true, beta_profile: true },
    });
    if (!workspace) throw new NotFoundException("Workspace no encontrado.");

    const betaProfile =
      profile === "emprende"
        ? EMPRENDE_ELIGIBLE_PROFILE
        : workspace.beta_profile === EMPRENDE_ELIGIBLE_PROFILE
          ? null
          : workspace.beta_profile;

    const updated = await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: { profile, beta_profile: betaProfile },
      select: { id: true, name: true, slug: true, plan: true, profile: true, beta_profile: true },
    });

    await this.audit.log(workspace.id, {
      user_id: actorUserId,
      action: "WORKSPACE_PROFILE_UPDATED",
      entity_type: "workspace",
      entity_id: workspace.id,
      before: { profile: workspace.profile, beta_profile: workspace.beta_profile },
      after: { profile, beta_profile: betaProfile },
    });

    return updated;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException("Usuario no encontrado.");
    return user;
  }

  // ── Support case helpers (platform admin) ─────────────────────────────────

  async getSupportCaseWorkspace(caseId: string) {
    const rec = await this.prisma.supportDiagnosticCase.findUnique({
      where: { id: caseId },
      select: { workspace_id: true },
    });
    if (!rec) throw new NotFoundException("Caso no encontrado.");
    return rec;
  }

  async getOrchestrationRunsForCase(caseId: string) {
    return this.prisma.supportOrchestrationRun.findMany({
      where: { diagnostic_case_id: caseId },
      orderBy: { created_at: "desc" },
      take: 10,
      select: {
        id: true,
        tier: true,
        status: true,
        case_type: true,
        severity: true,
        needs_human_review: true,
        stages_json: true,
        summary: true,
        created_at: true,
      },
    });
  }

  // ── Router metrics (platform-wide) ────────────────────────────────────────

  async getRouterMetrics(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.routerMetricsSnapshot.findMany({
      where: { date: { gte: since } },
    });

    const wsIds = [...new Set(rows.map((r) => r.workspace_id))];
    const workspaces = await this.prisma.workspace.findMany({
      where: { id: { in: wsIds } },
      select: { id: true, name: true, slug: true },
    });
    const wsMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));

    let totalCalls = 0;
    let repliedCalls = 0;
    let blockedCalls = 0;
    let tokensConsumed = 0;
    let tokensSaved = 0;
    const byIntent: Record<string, number> = {};
    const byModelTier: Record<string, number> = {};
    const byAgentType: Record<string, number> = {};
    const byWorkspace: Record<string, { name: string; slug: string; calls: number; replied: number; blocked: number; tokensSaved: number }> = {};

    for (const row of rows) {
      totalCalls += row.call_count;
      repliedCalls += row.reply_count;
      blockedCalls += row.blocked_count;
      tokensConsumed += row.tokens_consumed;
      tokensSaved += row.tokens_saved;
      byIntent[row.intent] = (byIntent[row.intent] ?? 0) + row.call_count;
      byModelTier[row.model_tier] = (byModelTier[row.model_tier] ?? 0) + row.call_count;
      byAgentType[row.agent_type] = (byAgentType[row.agent_type] ?? 0) + row.call_count;

      if (!byWorkspace[row.workspace_id]) {
        const ws = wsMap[row.workspace_id];
        byWorkspace[row.workspace_id] = {
          name: ws?.name ?? row.workspace_id,
          slug: ws?.slug ?? row.workspace_id,
          calls: 0, replied: 0, blocked: 0, tokensSaved: 0,
        };
      }
      byWorkspace[row.workspace_id].calls += row.call_count;
      byWorkspace[row.workspace_id].replied += row.reply_count;
      byWorkspace[row.workspace_id].blocked += row.blocked_count;
      byWorkspace[row.workspace_id].tokensSaved += row.tokens_saved;
    }

    const topWorkspaces = Object.values(byWorkspace)
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 20);

    return {
      days,
      totalCalls,
      repliedCalls,
      blockedCalls,
      replyRate: totalCalls > 0 ? repliedCalls / totalCalls : 0,
      tokensConsumed,
      tokensSaved,
      byIntent: Object.entries(byIntent).sort((a, b) => b[1] - a[1]).map(([intent, count]) => ({ intent, count })),
      byModelTier: Object.entries(byModelTier).sort((a, b) => b[1] - a[1]).map(([tier, count]) => ({ tier, count })),
      byAgentType: Object.entries(byAgentType).sort((a, b) => b[1] - a[1]).map(([agent, count]) => ({ agent, count })),
      topWorkspaces,
    };
  }

  private generateTemporaryPassword() {
    return `${randomBytes(9).toString("base64url")}aA1!`;
  }
}
