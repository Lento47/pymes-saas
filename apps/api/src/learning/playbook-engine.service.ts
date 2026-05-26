import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

type PlaybookStatus = "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE";

@Injectable()
export class PlaybookEngineService {
  private readonly logger = new Logger(PlaybookEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  listSuggestions(workspaceId: string, status?: PlaybookStatus) {
    return this.prisma.playbookSuggestion.findMany({
      where: {
        workspace_id: workspaceId,
        ...(status && { status }),
      },
      orderBy: [{ confidence: "desc" }, { created_at: "desc" }],
    });
  }

  suggest(
    workspaceId: string,
    title: string,
    reason: string | null,
    trigger: Record<string, unknown>,
    actions: unknown[],
    confidence = 0,
  ) {
    return this.prisma.playbookSuggestion.create({
      data: {
        workspace_id: workspaceId,
        title,
        reason,
        trigger_json: trigger,
        actions_json: actions,
        confidence,
        status: "PENDING",
      },
    });
  }

  async updateStatus(workspaceId: string, id: string, status: PlaybookStatus) {
    const suggestion = await this.prisma.playbookSuggestion.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!suggestion) throw new NotFoundException("Playbook suggestion not found");

    return this.prisma.playbookSuggestion.update({
      where: { id },
      data: { status },
    });
  }
}
