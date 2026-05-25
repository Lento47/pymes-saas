import { randomBytes } from "crypto";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";

@Injectable()
export class InviteCodesService {
  private readonly logger = new Logger(InviteCodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async list(workspaceId: string) {
    return this.prisma.invitationCode.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
    });
  }

  async generate(
    workspaceId: string,
    dto: { role: string; max_uses?: number; expires_in_days?: number },
    userId: string,
  ) {
    await this.planLimits.checkInviteCodeLimit(workspaceId);

    const role = dto.role || "AGENT";
    if (!["ADMIN", "AGENT", "VIEWER"].includes(role)) {
      throw new BadRequestException("Rol inválido. Usá ADMIN, AGENT o VIEWER.");
    }

    const maxUses = Math.min(dto.max_uses ?? 5, 100);
    const expiresInDays = Math.min(dto.expires_in_days ?? 7, 365);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const code = this.generateCode();

    const record = await this.prisma.invitationCode.create({
      data: {
        workspace_id: workspaceId,
        code,
        role,
        max_uses: maxUses,
        expires_at: expiresAt,
        created_by: userId,
      },
    });

    this.logger.log(`Invite code generated: ${code} for workspace ${workspaceId}`);
    return record;
  }

  async revoke(workspaceId: string, id: string) {
    const record = await this.prisma.invitationCode.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!record) throw new NotFoundException("Código no encontrado.");

    return this.prisma.invitationCode.update({
      where: { id },
      data: { is_active: false },
    });
  }

  async redeem(code: string) {
    const record = await this.prisma.invitationCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
    });

    if (!record || !record.is_active) {
      throw new BadRequestException("Código inválido o expirado.");
    }
    if (new Date() > record.expires_at) {
      throw new BadRequestException("Este código ya expiró.");
    }
    if (record.used_count >= record.max_uses) {
      throw new BadRequestException("Este código ya alcanzó el límite de usos.");
    }

    return {
      workspace_id: record.workspace_id,
      workspace_name: record.workspace.name,
      workspace_slug: record.workspace.slug,
      role: record.role,
      code: record.code,
      code_id: record.id,
    };
  }

  async markUsed(codeId: string) {
    await this.prisma.invitationCode.update({
      where: { id: codeId },
      data: { used_count: { increment: 1 } },
    });
  }

  private generateCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const entropy = randomBytes(12);
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(entropy[i] % chars.length);
    }
    return result;
  }
}
