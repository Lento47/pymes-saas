import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { WorkspacePlan } from '@prisma/client';

export class QuotaExceededError extends BadRequestException {
  constructor(
    public resourceType: string,
    public current: number,
    public limit: number,
    public plan: WorkspacePlan,
    public upgradeTo?: WorkspacePlan,
  ) {
    super({
      error: 'QUOTA_EXCEEDED',
      message: `You've reached your ${resourceType} limit (${limit}). Upgrade your plan to add more.`,
      resourceType,
      current,
      limit,
      plan,
      upgradeTo,
    });
  }
}

interface PlanLimits {
  contacts: number;
  invoicesPerMonth: number;
  automations: number;
  storageGB: number;
  users: number;
}

@Injectable()
export class PlanLimitsService {
  private readonly PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
    STARTER: {
      contacts: 500,
      invoicesPerMonth: 100,
      automations: 5,
      storageGB: 5,
      users: 1,
    },
    GROWTH: {
      contacts: 2500,
      invoicesPerMonth: 500,
      automations: 25,
      storageGB: 10,
      users: 5,
    },
    BUSINESS: {
      contacts: 15000,
      invoicesPerMonth: 2000,
      automations: 100,
      storageGB: 50,
      users: 15,
    },
    ENTERPRISE: {
      contacts: 999999,
      invoicesPerMonth: 999999,
      automations: 999999,
      storageGB: 999999,
      users: 999999,
    },
    FREE: {
      contacts: 500,
      invoicesPerMonth: 100,
      automations: 5,
      storageGB: 5,
      users: 1,
    },
  };

  constructor(private prisma: PrismaService) {}

  getLimits(plan: WorkspacePlan): PlanLimits {
    return this.PLAN_LIMITS[plan] || this.PLAN_LIMITS.STARTER;
  }

  async checkContactLimit(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) throw new Error('Workspace not found');

    const limits = this.getLimits(workspace.plan);
    const currentCount = await this.prisma.contact.count({
      where: { workspace_id: workspaceId },
    });

    if (currentCount >= limits.contacts) {
      throw new QuotaExceededError(
        'contacts',
        currentCount,
        limits.contacts,
        workspace.plan,
        this.getUpgradePlan(workspace.plan),
      );
    }
  }

  async checkInvoiceLimit(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) throw new Error('Workspace not found');

    const limits = this.getLimits(workspace.plan);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const currentCount = await this.prisma.invoice.count({
      where: {
        workspace_id: workspaceId,
        created_at: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    if (currentCount >= limits.invoicesPerMonth) {
      throw new QuotaExceededError(
        'invoices this month',
        currentCount,
        limits.invoicesPerMonth,
        workspace.plan,
        this.getUpgradePlan(workspace.plan),
      );
    }
  }

  async checkAutomationLimit(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) throw new Error('Workspace not found');

    const limits = this.getLimits(workspace.plan);
    const currentCount = await this.prisma.automationRule.count({
      where: { workspace_id: workspaceId },
    });

    if (currentCount >= limits.automations) {
      throw new QuotaExceededError(
        'automations',
        currentCount,
        limits.automations,
        workspace.plan,
        this.getUpgradePlan(workspace.plan),
      );
    }
  }

  async checkUserLimit(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) throw new Error('Workspace not found');

    const limits = this.getLimits(workspace.plan);
    const currentCount = await this.prisma.workspaceUser.count({
      where: { workspace_id: workspaceId },
    });

    if (currentCount >= limits.users) {
      throw new QuotaExceededError(
        'users',
        currentCount,
        limits.users,
        workspace.plan,
        this.getUpgradePlan(workspace.plan),
      );
    }
  }

  getUpgradePlan(currentPlan: WorkspacePlan): WorkspacePlan {
    const upgradePath: Record<WorkspacePlan, WorkspacePlan> = {
      STARTER: 'GROWTH',
      GROWTH: 'BUSINESS',
      BUSINESS: 'ENTERPRISE',
      ENTERPRISE: 'ENTERPRISE',
      FREE: 'STARTER',
    };
    return upgradePath[currentPlan] || 'GROWTH';
  }
}
