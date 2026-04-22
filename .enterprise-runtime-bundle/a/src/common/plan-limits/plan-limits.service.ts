import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Plan limits definition ───────────────────────────────────────────────────
// Adjust these values as your plan tiers evolve.
// Use Infinity for truly unlimited.

export const PLAN_LIMITS: Record<
  string,
  {
    members: number;
    automations: number;
    contacts: number;
    documents: number;
    storageBytes: number;
  }
> = {
  FREE: {
    members: 3,
    automations: 5,
    contacts: 500,
    documents: 50,
    storageBytes: 100 * 1024 * 1024, // 100 MB
  },
  STARTER: {
    members: 10,
    automations: 25,
    contacts: 5000,
    documents: 500,
    storageBytes: 1 * 1024 * 1024 * 1024, // 1 GB
  },
  GROWTH: {
    members: 50,
    automations: 100,
    contacts: 50000,
    documents: 5000,
    storageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
  },
  ENTERPRISE: {
    members: Infinity,
    automations: Infinity,
    contacts: Infinity,
    documents: Infinity,
    storageBytes: Infinity,
  },
};

const PLAN_NAMES: Record<string, string> = {
  FREE: 'Gratis',
  STARTER: 'Starter ($49/mes)',
  GROWTH: 'Growth ($149/mes)',
  ENTERPRISE: 'Enterprise',
};

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getWorkspacePlan(workspaceId: string) {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    return ws.plan;
  }

  private getLimits(plan: string) {
    return PLAN_LIMITS[plan] ?? PLAN_LIMITS['FREE'];
  }

  // ── Public enforcement methods ────────────────────────────────────────────

  async enforceMembers(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = this.getLimits(plan);
    if (limits.members === Infinity) return;

    const current = await this.prisma.workspaceUser.count({
      where: { workspace_id: workspaceId },
    });

    if (current >= limits.members) {
      throw new ForbiddenException(
        `Tu plan ${plan} permite un máximo de ${limits.members} miembro(s). ` +
          `Upgrade a ${PLAN_NAMES[this.nextPlan(plan)]} para agregar más.`,
      );
    }
  }

  async enforceAutomations(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = this.getLimits(plan);
    if (limits.automations === Infinity) return;

    const current = await this.prisma.automationRule.count({
      where: { workspace_id: workspaceId },
    });

    if (current >= limits.automations) {
      throw new ForbiddenException(
        `Tu plan ${plan} permite un máximo de ${limits.automations} automatizacion(es). ` +
          `Upgrade a ${PLAN_NAMES[this.nextPlan(plan)]} para crear más.`,
      );
    }
  }

  async enforceContacts(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = this.getLimits(plan);
    if (limits.contacts === Infinity) return;

    const current = await this.prisma.contact.count({
      where: { workspace_id: workspaceId },
    });

    if (current >= limits.contacts) {
      throw new ForbiddenException(
        `Tu plan ${plan} permite un máximo de ${limits.contacts.toLocaleString()} contacto(s). ` +
          `Upgrade a ${PLAN_NAMES[this.nextPlan(plan)]} para agregar más.`,
      );
    }
  }

  async enforceDocuments(workspaceId: string, newFileSizeBytes: number): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = this.getLimits(plan);

    if (limits.documents !== Infinity) {
      const currentCount = await this.prisma.document.count({
        where: { workspace_id: workspaceId },
      });
      if (currentCount >= limits.documents) {
        throw new ForbiddenException(
          `Tu plan ${plan} permite un máximo de ${limits.documents} documento(s). ` +
            `Upgrade a ${PLAN_NAMES[this.nextPlan(plan)]} para subir más.`,
        );
      }
    }

    if (limits.storageBytes !== Infinity) {
      const agg = await this.prisma.document.aggregate({
        where: { workspace_id: workspaceId },
        _sum: { file_size: true },
      });
      const usedBytes = agg._sum.file_size ?? 0;
      if (usedBytes + newFileSizeBytes > limits.storageBytes) {
        const usedMB = (usedBytes / 1024 / 1024).toFixed(1);
        const limitMB = (limits.storageBytes / 1024 / 1024).toFixed(0);
        throw new ForbiddenException(
          `Límite de almacenamiento alcanzado (${usedMB} MB / ${limitMB} MB en plan ${plan}). ` +
            `Upgrade a ${PLAN_NAMES[this.nextPlan(plan)]} para obtener más espacio.`,
        );
      }
    }
  }

  // ── Helper: next plan up ─────────────────────────────────────────────────

  private nextPlan(current: string): string {
    const order = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'];
    const idx = order.indexOf(current);
    return order[Math.min(idx + 1, order.length - 1)];
  }
}
