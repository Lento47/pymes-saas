import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';

@Injectable()
export class EnterpriseService {
  private readonly logger = new Logger(EnterpriseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async getConfig(workspaceId: string) {
    return this.prisma.workspaceEnterpriseConfig.findUnique({
      where: { workspace_id: workspaceId },
    });
  }

  async upsertConfig(workspaceId: string, data: any) {
    const existing = await this.prisma.workspaceEnterpriseConfig.findUnique({
      where: { workspace_id: workspaceId },
    });

    const config = existing
      ? await this.prisma.workspaceEnterpriseConfig.update({
          where: { workspace_id: workspaceId },
          data: {
            contract_type: data.contract_type,
            contract_start_date: data.contract_start_date ? new Date(data.contract_start_date) : undefined,
            contract_end_date: data.contract_end_date ? new Date(data.contract_end_date) : undefined,
            custom_monthly_price: data.custom_monthly_price,
            custom_annual_price: data.custom_annual_price,
            currency: data.currency,
            custom_limits: data.custom_limits ?? undefined,
            enabled_capabilities: data.enabled_capabilities ?? [],
            sla_tier: data.sla_tier,
            onboarding_tier: data.onboarding_tier,
            support_tier: data.support_tier,
            security_tier: data.security_tier,
            contract_notes: data.contract_notes,
            internal_notes: data.internal_notes,
          },
        })
      : await this.prisma.workspaceEnterpriseConfig.create({
          data: {
            workspace: { connect: { id: workspaceId } },
            contract_type: data.contract_type,
            contract_start_date: data.contract_start_date ? new Date(data.contract_start_date) : null,
            contract_end_date: data.contract_end_date ? new Date(data.contract_end_date) : null,
            custom_monthly_price: data.custom_monthly_price,
            custom_annual_price: data.custom_annual_price,
            currency: data.currency ?? 'CRC',
            custom_limits: data.custom_limits ?? undefined,
            enabled_capabilities: data.enabled_capabilities ?? [],
            sla_tier: data.sla_tier,
            onboarding_tier: data.onboarding_tier,
            support_tier: data.support_tier,
            security_tier: data.security_tier,
            contract_notes: data.contract_notes,
            internal_notes: data.internal_notes,
          },
        });

    this.logger.log(`Enterprise config ${existing ? 'updated' : 'created'} for workspace ${workspaceId}`);
    return config;
  }

  async deleteConfig(workspaceId: string) {
    await this.prisma.workspaceEnterpriseConfig.deleteMany({
      where: { workspace_id: workspaceId },
    });
  }

  async getCustomLimits(workspaceId: string) {
    const config = await this.getConfig(workspaceId);
    return config?.custom_limits ?? null;
  }

  async isCapabilityEnabled(workspaceId: string, capabilityKey: string): Promise<boolean> {
    const config = await this.getConfig(workspaceId);
    if (!config) return false;
    return (config.enabled_capabilities ?? []).includes(capabilityKey);
  }

  // ─── Capabilities admin ──────────────────────────────────────────────

  async getCapabilities() {
    return this.prisma.businessPlusCapability.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async upsertCapability(id: string | undefined, data: any) {
    if (id) {
      return this.prisma.businessPlusCapability.update({
        where: { id },
        data: {
          key: data.key,
          name: data.name,
          description: data.description,
          status: data.status,
          visible_on_pricing: data.visible_on_pricing,
          visible_in_admin: data.visible_in_admin,
          requires_sales_approval: data.requires_sales_approval,
          requires_setup: data.requires_setup,
          documentation_url: data.documentation_url,
        },
      });
    }
    return this.prisma.businessPlusCapability.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        status: data.status ?? 'ROADMAP',
        visible_on_pricing: data.visible_on_pricing ?? false,
        visible_in_admin: data.visible_in_admin ?? true,
        requires_sales_approval: data.requires_sales_approval ?? false,
        requires_setup: data.requires_setup ?? false,
        documentation_url: data.documentation_url,
      },
    });
  }
}
