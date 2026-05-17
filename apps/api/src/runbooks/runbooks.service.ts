import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RUNBOOK_REGISTRY, RUNBOOK_DESCRIPTORS } from './runbooks.registry';
import type {
  RunbookDescriptor,
  RunbookExecutionContext,
} from './runbooks.types';

interface ExecuteRunbookInput {
  runbookName: string;
  workspaceId: string;
  executedByUserId: string;
  diagnosticCaseId?: string;
  params: Record<string, string>;
}

@Injectable()
export class RunbooksService {
  private readonly logger = new Logger(RunbooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  listRunbooks(): RunbookDescriptor[] {
    return RUNBOOK_DESCRIPTORS;
  }

  /**
   * Execute a runbook end-to-end:
   *   1. Look up the runbook in the registry; reject if unknown.
   *   2. Validate every required parameter is present.
   *   3. Verify the workspace exists.
   *   4. Insert a `runbook_executions` row in PENDING state.
   *   5. Run the executor; on success/failure update the row.
   *
   * RBAC is enforced at the controller layer via PlatformAdminGuard.
   * The service trusts that the caller has been authorized.
   */
  async execute(input: ExecuteRunbookInput) {
    const entry = RUNBOOK_REGISTRY[input.runbookName];
    if (!entry) {
      throw new NotFoundException(`Runbook "${input.runbookName}" not found`);
    }

    // Parameter validation. Each required parameter must be a non-empty
    // string; type checking is intentionally lenient (we don't introspect
    // UUID format at this layer — the runbook itself does the lookup and
    // throws if the ID doesn't match a real row).
    const missing = entry.descriptor.parameters
      .filter((p) => p.required)
      .filter((p) => !input.params[p.key] || !String(input.params[p.key]).trim());
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required parameter(s): ${missing.map((p) => p.key).join(', ')}`,
      );
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace ${input.workspaceId} not found`);
    }

    const execution = await (this.prisma as any).runbookExecution.create({
      data: {
        workspace_id: input.workspaceId,
        diagnostic_case_id: input.diagnosticCaseId ?? null,
        runbook_name: input.runbookName,
        parameters_json: input.params as any,
        executed_by_user_id: input.executedByUserId,
        status: 'RUNNING',
      },
    });

    const startedAt = Date.now();
    const ctx: RunbookExecutionContext = {
      workspaceId: input.workspaceId,
      executedByUserId: input.executedByUserId,
      diagnosticCaseId: input.diagnosticCaseId,
      params: input.params,
      prisma: this.prisma,
    };

    try {
      const result = await entry.execute(ctx);
      const durationMs = Date.now() - startedAt;

      const finished = await (this.prisma as any).runbookExecution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS',
          result_json: result as any,
          duration_ms: durationMs,
          completed_at: new Date(),
        },
      });

      // Mirror the execution to the workspace audit log so OWNER/ADMIN
      // see "support ran $runbook on this workspace" in their feed.
      // Best-effort: a failure here doesn't roll back the runbook.
      await this.prisma.auditLog
        .create({
          data: {
            workspace_id: input.workspaceId,
            user_id: input.executedByUserId,
            action: 'runbook.executed',
            entity_type: 'runbook_execution',
            entity_id: finished.id,
            after_json: {
              runbook_name: input.runbookName,
              parameters: input.params,
              summary: result.summary,
              duration_ms: durationMs,
            } as any,
          },
        })
        .catch((err) => {
          this.logger.warn(`AuditLog write failed for runbook ${input.runbookName}: ${err?.message}`);
        });

      this.logger.log(
        `Runbook ${input.runbookName} succeeded for workspace=${input.workspaceId} user=${input.executedByUserId} duration=${durationMs}ms`,
      );

      return {
        execution_id: finished.id,
        status: finished.status,
        summary: result.summary,
        details: result.details ?? {},
        duration_ms: durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorLog = err?.message ?? String(err);

      await (this.prisma as any).runbookExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILURE',
          error_log: errorLog,
          duration_ms: durationMs,
          completed_at: new Date(),
        },
      });

      this.logger.warn(
        `Runbook ${input.runbookName} FAILED for workspace=${input.workspaceId} user=${input.executedByUserId} error=${errorLog}`,
      );

      throw new BadRequestException(`Runbook execution failed: ${errorLog}`);
    }
  }

  /** Recent executions for the support UI history view. */
  async listExecutions(workspaceId?: string, limit = 50) {
    return (this.prisma as any).runbookExecution.findMany({
      where: workspaceId ? { workspace_id: workspaceId } : undefined,
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        workspace_id: true,
        runbook_name: true,
        status: true,
        parameters_json: true,
        result_json: true,
        error_log: true,
        duration_ms: true,
        executed_by_user_id: true,
        diagnostic_case_id: true,
        created_at: true,
        completed_at: true,
      },
    });
  }
}
