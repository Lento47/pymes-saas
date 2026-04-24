import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export class QuotaExceededError extends BadRequestException {
  constructor(
    public resourceType: string,
    public current: number,
    public limit: number,
    public plan: string,
    public upgradeTo: string,
  ) {
    const message = `You've reached your ${resourceType} limit (${limit}). Upgrade to ${upgradeTo} to add more.`;
    super({
      error: 'QUOTA_EXCEEDED',
      message,
      resourceType,
      current,
      limit,
      plan,
      upgradeTo,
    });
  }
}

@Injectable()
export class PlanLimitsService {
  private readonly PLAN_LIMITS: Record<string, { [key: string]: number }> = {
    STARTER: {
      contacts: 500,
      invoices_per_month: 100,
      automations: 5,
      users: 1,
      storage_gb: 1,
    },
    GROWTH: {
      contacts: 2500,
      invoices_per_month: 500,
      automations: 25,
      users: 5,
      storage_gb: 10,
    },
    BUSINESS: {
      contacts: 15000,
      invoices_per_month: 2000,
      automations: 100,
      users: 15,
      storage_gb: 50,
    },
    ENTERPRISE: {
      contacts: 999999,
      invoices_per_month: 999999,
      automations: 999999,
      users: 999999,
      storage_gb: 999999,
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  private async getWorkspacePlan(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });
    return workspace?.plan || 'STARTER';
  }

  private getUpgradePlan(currentPlan: string): string {
    const planHierarchy = ['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    if (currentIndex === -1 || currentIndex === planHierarchy.length - 1) {
      return 'ENTERPRISE';
    }
    return planHierarchy[currentIndex + 1];
  }

  async checkContactLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = this.PLAN_LIMITS[plan].contacts;

    const contactCount = await this.prisma.contact.count({
      where: { workspace_id: workspaceId },
    });

    if (contactCount >= limit) {
      throw new QuotaExceededError(
        'contacts',
        contactCount,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }

  async checkInvoiceLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = this.PLAN_LIMITS[plan].invoices_per_month;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const invoiceCount = await this.prisma.invoice.count({
      where: {
        workspace_id: workspaceId,
        created_at: { gte: monthStart },
      },
    });

    if (invoiceCount >= limit) {
      throw new QuotaExceededError(
        'invoices per month',
        invoiceCount,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }

  async checkAutomationLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = this.PLAN_LIMITS[plan].automations;

    const automationCount = await this.prisma.automationRule.count({
      where: { workspace_id: workspaceId },
    });

    if (automationCount >= limit) {
      throw new QuotaExceededError(
        'automations',
        automationCount,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }

  async checkUserLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = this.PLAN_LIMITS[plan].users;

    const userCount = await this.prisma.workspaceUser.count({
      where: { workspace_id: workspaceId },
    });

    if (userCount >= limit) {
      throw new QuotaExceededError(
        'users',
        userCount,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }
}
