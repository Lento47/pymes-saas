import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { ContactMemoryService } from "./contact-memory.service";
import { CreditsService } from "./credits.service";

@Injectable()
export class MemoryTtlJob {
  private readonly logger = new Logger(MemoryTtlJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactMemory: ContactMemoryService,
    private readonly credits: CreditsService,
  ) {}

  // Runs on the 1st of every month at 02:00 UTC
  @Cron("0 2 1 * *")
  async runDailyTtlCheck(): Promise<void> {
    this.logger.log("Starting monthly memory TTL check...");

    // 1. Get all workspaces that have any memory records
    const workspaces = await this.prisma.contactAiMemory.groupBy({
      by: ["workspace_id"],
    });

    let totalPaused = 0;
    let totalDeducted = 0;

    for (const { workspace_id } of workspaces) {
      try {
        // 2. Pause expired memories
        const paused = await this.contactMemory.pauseExpired(workspace_id);
        totalPaused += paused;

        // 3. Deduct 1 credit per active EXTENDED contact-memory
        const activeCount = await this.contactMemory.countActiveMemories(workspace_id);
        if (activeCount > 0) {
          const { success, newBalance } = await this.credits.deductCredits(
            workspace_id,
            activeCount,
            `Memoria activa: ${activeCount} contacto(s)`,
          );

          if (!success) {
            // No credits → pause all EXTENDED memories for this workspace
            await this.prisma.contactAiMemory.updateMany({
              where: { workspace_id, status: "EXTENDED" },
              data: { status: "PAUSED" },
            });
            this.logger.warn(
              `Workspace ${workspace_id}: out of credits — paused ${activeCount} extended memories`,
            );
          } else {
            totalDeducted += activeCount;
            this.logger.log(
              `Workspace ${workspace_id}: deducted ${activeCount} credits. Balance: ${newBalance}`,
            );
          }
        }
      } catch (err) {
        this.logger.error(`TTL job failed for workspace ${workspace_id}`, err);
      }
    }

    this.logger.log(
      `Monthly TTL check complete. Paused: ${totalPaused}, Credits deducted: ${totalDeducted}`,
    );
  }
}
