import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Structured quota error ──────────────────────────────────────────────────

export class QuotaExceededError extends ForbiddenException {
  constructor(
    public resourceType: string,
    public current: number,
    public limit: number,
    public plan: string,
    public upgradeTo: string,
  ) {
    const message = `Tu plan ${plan} permite un máximo de ${limit} ${resourceType}. Upgrade a ${upgradeTo} para agregar más.`;
    super({ error: 'QUOTA_EXCEEDED', message, resourceType, current, limit, plan, upgradeTo });
  }
}

// ─── Plan limits definition ──────────────────────────────────────────────────

interface PlanLimits {
  users: number;
  automations: number;
  contacts: number;
  documents: number;
  invoices_per_month: number;
  storage_bytes: number;
}

export type { PlanLimits };

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  FREE: {
    users: 3,
    automations: 5,
    contacts: 500,
    documents: 50,
    invoices_per_month: 50,
    storage_bytes: 100 * 1024 * 1024, // 100 MB
  },
  STARTER: {
    users: 10,
    automations: 25,
    contacts: 5_000,
    documents: 500,
    invoices_per_month: 200,
    storage_bytes: 1 * 1024 * 1024 * 1024, // 1 GB
  },
  GROWTH: {
    users: 50,
    automations: 100,
    contacts: 50_000,
    documents: 5_000,
    invoices_per_month: 1_000,
    storage_bytes: 10 * 1024 * 1024 * 1024, // 10 GB
  },
  ENTERPRISE: {
    users: Infinity,
    automations: Infinity,
    contacts: Infinity,
    documents: Infinity,
    invoices_per_month: Infinity,
    storage_bytes: Infinity,
  },
};

const PLAN_NAMES: Record<string, string> = {
  FREE: 'Gratis',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  ENTERPRISE: 'Enterprise',
};

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public helpers ────────────────────────────────────────────────────────

  getUpgradePlan(currentPlan: string): string {
    const order = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'];
    const idx = order.indexOf(currentPlan);
    return order[Math.min(idx + 1, order.length - 1)];
  }

  getLimits(plan: string): PlanLimits {
    return { ...(PLAN_LIMITS[plan] ?? PLAN_LIMITS['FREE']) };
  }

  async isPlanAtLeast(workspaceId: string, minimumPlan: string): Promise<boolean> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const order = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'];
    return order.indexOf(plan) >= order.indexOf(minimumPlan);
  }

  async enforcePlanTier(workspaceId: string, minimumPlan: string, featureName: string): Promise<void> {
    const ok = await this.isPlanAtLeast(workspaceId, minimumPlan);
    if (!ok) {
      const plan = await this.getWorkspacePlan(workspaceId);
      throw new ForbiddenException(
        `${featureName} requiere plan ${minimumPlan} o superior. Tu plan actual es ${plan}.`,
      );
    }
  }

  // ── Private: resolve workspace plan ─────────────────────────────────────

  private async getWorkspacePlan(workspaceId: string): Promise<string> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    return ws.plan;
  }

  // ── Public check methods (used by services) ─────────────────────────────

  async checkUserLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = this.getLimits(plan).users;
    if (limit === Infinity) return;

    const current = await this.prisma.workspaceUser.count({ where: { workspace_id: workspaceId } });
    if (current >= limit) {
      throw new QuotaExceededError('miembros', current, limit, plan, this.getUpgradePlan(plan));
    }
  }

  async checkAutomationLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = this.getLimits(plan).automations;
    if (limit === Infinity) return;

    const current = await this.prisma.automationRule.count({ where: { workspace_id: workspaceId } });
    if (current >= limit) {
      throw new QuotaExceededError('automatizaciones', current, limit, plan, this.getUpgradePlan(plan));
    }
  }

  async checkContactLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = this.getLimits(plan).contacts;
    if (limit === Infinity) return;

    const current = await this.prisma.contact.count({ where: { workspace_id: workspaceId } });
    if (current >= limit) {
      throw new QuotaExceededError('contactos', current, limit, plan, this.getUpgradePlan(plan));
    }
  }

  async checkInvoiceLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = this.getLimits(plan).invoices_per_month;
    if (limit === Infinity) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const current = await this.prisma.invoice.count({
      where: { workspace_id: workspaceId, created_at: { gte: monthStart } },
    });
    if (current >= limit) {
      throw new QuotaExceededError('facturas este mes', current, limit, plan, this.getUpgradePlan(plan));
    }
  }

  // ── enforceXxx methods (backward-compat aliases used by controllers) ────

  async enforceMembers(workspaceId: string): Promise<void> {
    await this.checkUserLimit(workspaceId);
  }

  async enforceAutomations(workspaceId: string): Promise<void> {
    await this.checkAutomationLimit(workspaceId);
  }

  async enforceContacts(workspaceId: string): Promise<void> {
    await this.checkContactLimit(workspaceId);
  }

  async enforceDocuments(workspaceId: string, newFileSizeBytes: number): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = this.getLimits(plan);

    if (limits.documents !== Infinity) {
      const currentCount = await this.prisma.document.count({ where: { workspace_id: workspaceId } });
      if (currentCount >= limits.documents) {
        throw new QuotaExceededError('documentos', currentCount, limits.documents, plan, this.getUpgradePlan(plan));
      }
    }

    if (limits.storage_bytes !== Infinity) {
      const agg = await this.prisma.document.aggregate({
        where: { workspace_id: workspaceId },
        _sum: { file_size: true },
      });
      const usedBytes = agg._sum.file_size ?? 0;
      if (usedBytes + newFileSizeBytes > limits.storage_bytes) {
        const usedMB = (usedBytes / 1024 / 1024).toFixed(1);
        const limitMB = (limits.storage_bytes / 1024 / 1024).toFixed(0);
        throw new QuotaExceededError(
          'almacenamiento',
          parseFloat(usedMB),
          parseFloat(limitMB),
          plan,
          this.getUpgradePlan(plan),
        );
      }
    }
  }
}
