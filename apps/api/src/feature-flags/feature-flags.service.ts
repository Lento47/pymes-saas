import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: string, workspaceId: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag || !flag.enabled) return false;

    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });
    if (!ws) return false;

    const planOrder = ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE', 'BUSINESS_PLUS'];
    const normalizedPlan = ws.plan === 'ENTERPRISE' ? 'BUSINESS' : ws.plan;
    const flagPlan = flag.required_plan === 'ENTERPRISE' ? 'BUSINESS' : flag.required_plan;

    return planOrder.indexOf(normalizedPlan) >= planOrder.indexOf(flagPlan);
  }

  async getAll(workspaceId: string): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany({ where: { enabled: true } });
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });

    const planOrder = ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE', 'BUSINESS_PLUS'];
    const normalizedPlan = ws?.plan === 'ENTERPRISE' ? 'BUSINESS' : (ws?.plan ?? 'FREE');

    const result: Record<string, boolean> = {};
    for (const flag of flags) {
      const flagPlan = flag.required_plan === 'ENTERPRISE' ? 'BUSINESS' : flag.required_plan;
      result[flag.key] = planOrder.indexOf(normalizedPlan) >= planOrder.indexOf(flagPlan);
    }
    return result;
  }

  async getPublicFlags(): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany({ where: { enabled: true } });
    const result: Record<string, boolean> = {};
    for (const flag of flags) {
      result[flag.key] = true; // Public view just shows flag existence
    }
    return result;
  }

  async upsertFlag(id: string | undefined, data: any) {
    if (id) {
      return this.prisma.featureFlag.update({
        where: { id },
        data: {
          key: data.key,
          name: data.name,
          description: data.description,
          required_plan: data.required_plan,
          enabled: data.enabled,
        },
      });
    }
    return this.prisma.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        required_plan: data.required_plan ?? 'FREE',
        enabled: data.enabled ?? true,
      },
    });
  }

  async deleteFlag(id: string) {
    return this.prisma.featureFlag.delete({ where: { id } });
  }
}
