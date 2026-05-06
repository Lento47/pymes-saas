import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { RunbooksService } from './runbooks.service';

interface ExecuteRunbookBody {
  runbook_name: string;
  workspace_id: string;
  diagnostic_case_id?: string;
  params?: Record<string, string>;
}

/**
 * Runbooks expose pre-approved support actions to platform admins.
 * Every endpoint requires `is_platform_admin = true`. The endpoints are
 * intentionally narrow: list, execute, history. Catalog management is
 * code-only (modify the registry and ship a release).
 */
@Controller('platform/runbooks')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class RunbooksController {
  constructor(private readonly runbooks: RunbooksService) {}

  /** GET /platform/runbooks — return the catalog of available runbooks. */
  @Get()
  list() {
    return { runbooks: this.runbooks.listRunbooks() };
  }

  /** GET /platform/runbooks/executions?workspace_id=&limit= — recent invocations. */
  @Get('executions')
  history(
    @Query('workspace_id') workspaceId: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    const parsedLimit = limit ? Math.max(1, Math.min(parseInt(limit, 10) || 50, 200)) : 50;
    return this.runbooks.listExecutions(workspaceId, parsedLimit);
  }

  /** POST /platform/runbooks/execute — run a runbook against a workspace. */
  @Post('execute')
  async execute(@CurrentUser() user: AuthUser, @Body() body: ExecuteRunbookBody) {
    if (!body?.runbook_name || !body?.workspace_id) {
      throw new BadRequestException('runbook_name and workspace_id are required');
    }
    return this.runbooks.execute({
      runbookName: body.runbook_name,
      workspaceId: body.workspace_id,
      executedByUserId: user.id,
      diagnosticCaseId: body.diagnostic_case_id,
      params: body.params ?? {},
    });
  }
}
