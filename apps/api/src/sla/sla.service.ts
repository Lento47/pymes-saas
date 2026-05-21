import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPolicies() {
    return this.prisma.slaPolicy.findMany({ orderBy: { key: "asc" } });
  }

  async getPolicyByKey(key: string) {
    return this.prisma.slaPolicy.findUnique({ where: { key } });
  }

  async upsertPolicy(id: string | undefined, data: Record<string, any>) {
    if (id) {
      return this.prisma.slaPolicy.update({
        where: { id },
        data: {
          key: data.key,
          name: data.name,
          support_window: data.support_window,
          first_response_target_minutes: data.first_response_target_minutes,
          resolution_target_hours: data.resolution_target_hours,
          uptime_target_percent: data.uptime_target_percent,
          applies_to_plan: data.applies_to_plan,
          requires_contract: data.requires_contract,
          description: data.description,
        },
      });
    }
    return this.prisma.slaPolicy.create({
      data: {
        key: data.key,
        name: data.name,
        support_window: data.support_window,
        first_response_target_minutes: data.first_response_target_minutes,
        resolution_target_hours: data.resolution_target_hours,
        uptime_target_percent: data.uptime_target_percent,
        applies_to_plan: data.applies_to_plan ?? "BUSINESS_PLUS",
        requires_contract: data.requires_contract ?? false,
        description: data.description,
      },
    });
  }

  async getWorkspaceAssignment(workspaceId: string) {
    return this.prisma.workspaceSlaAssignment.findFirst({
      where: { workspace_id: workspaceId },
      include: { sla_policy: true },
      orderBy: { effective_from: "desc" },
    });
  }

  async assignPolicy(workspaceId: string, slaPolicyId: string, data?: Record<string, any>) {
    return this.prisma.workspaceSlaAssignment.create({
      data: {
        workspace: { connect: { id: workspaceId } },
        sla_policy: { connect: { id: slaPolicyId } },
        effective_from: data?.effective_from ? new Date(data.effective_from) : new Date(),
        effective_to: data?.effective_to ? new Date(data.effective_to) : null,
        contract_reference: data?.contract_reference,
      },
    });
  }

  async getDefaultSlaTargets(workspaceId: string): Promise<{
    firstResponseMinutes: number;
    resolutionHours: number;
  }> {
    const assignment = await this.getWorkspaceAssignment(workspaceId);
    if (assignment?.sla_policy) {
      return {
        firstResponseMinutes: assignment.sla_policy.first_response_target_minutes ?? 240,
        resolutionHours: assignment.sla_policy.resolution_target_hours ?? 24,
      };
    }
    return { firstResponseMinutes: 240, resolutionHours: 24 };
  }
}
