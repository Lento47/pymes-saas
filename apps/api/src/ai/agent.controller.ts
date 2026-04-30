import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Req,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AgentService } from './agent.service';
import { AgentToolsService } from './agent-tools.service';
import { AgentStreamDto } from './agent.dto';
import { CreateEscalationDto } from './agent-escalation.dto';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SupportRouterService } from './support-router.service';
import { DiagnosticService } from './diagnostic.service';
import { EngineeringFixService } from './engineering-fix.service';

@Controller('agent')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly toolsService: AgentToolsService,
    private readonly planLimits: PlanLimitsService,
    private readonly prisma: PrismaService,
    private readonly router: SupportRouterService,
    private readonly diagnostic: DiagnosticService,
    private readonly fixService: EngineeringFixService,
  ) {} 

  @Get('diagnostic-cases/:id')
  @Roles('ADMIN')
  async getDiagnosticCase(@Param('id') id: string) {
    const case_ = await this.fixService.getDiagnosticCaseForFix(id);
    if (!case_) throw new NotFoundException('Diagnostic case not found');
    return case_;
  }

  @Patch('fix-cases/:id')
  @Roles('ADMIN')
  async updateFixCase(
    @Param('id') fixCaseId: string,
    @Body() body: { status?: string; pr_url?: string; pr_number?: number; files_changed?: any; test_added?: any; fix_summary?: string; rollback_notes?: string; error_log?: string },
  ) {
    return this.fixService.updateFixStatus(fixCaseId, body);
  }

  @Post('fix-cases')
  @Roles('ADMIN')
  async createFixCase(
    @Body('diagnostic_case_id') diagnosticCaseId: string,
  ) {
    return this.fixService.createFixCase(diagnosticCaseId);
  }

  @Post('diagnose')
  @Roles('ADMIN', 'AGENT', 'VIEWER')
  async diagnose(
    @Body() body: { module: string; error_code?: string; trace_id?: string; user_description?: string },
    @CurrentUser('workspace_id') workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.diagnostic.diagnose({
      workspace_id: workspaceId,
      user_id: userId,
      module: body.module || 'unknown',
      error_code: body.error_code,
      trace_id: body.trace_id,
      user_description: body.user_description,
    });
    return result;
  }

  @Post('escalate')
  @Roles('ADMIN', 'AGENT', 'VIEWER')
  async escalate(
    @Body() dto: CreateEscalationDto,
    @CurrentUser('workspace_id') workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.planLimits.enforceAiAccess(workspaceId);

    const escalation = await this.prisma.agentEscalation.create({
      data: {
        workspace_id: workspaceId,
        user_id: userId,
        summary: dto.summary,
        severity: dto.severity || 'MEDIUM',
        evidence_json: (dto.evidence as any) || undefined,
        status: 'OPEN',
      },
    });

    return {
      id: escalation.id,
      status: escalation.status,
      severity: escalation.severity,
      summary: escalation.summary,
      created_at: escalation.created_at,
    };
  }

  @Post('execute')
  @Roles('ADMIN', 'AGENT', 'VIEWER')
  async executeTool(
    @Body() body: { tool: string; arguments?: Record<string, any> },
    @CurrentUser('workspace_id') workspaceId: string,
  ) {
    await this.planLimits.enforceAiAccess(workspaceId);
    return this.toolsService.execute(workspaceId, body.tool, body.arguments || {});
  }

  @Post('stream')
  @Roles('ADMIN', 'AGENT', 'VIEWER')
  async stream(
    @Body() dto: AgentStreamDto,
    @CurrentUser('workspace_id') workspaceId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.planLimits.enforceAiAccess(workspaceId);
    const input = dto.message || dto.input;
    if (!input || typeof input !== 'string') {
      res.status(400).json({ error: 'Se requiere message o input' });
      return;
    }

    const { agent, confidence } = this.router.classifyIntent(input);
    const conversationId = dto.conversationId || dto.conversation_id;
    const result = await this.agentService.streamWorkflow(
      workspaceId,
      input,
      conversationId,
      agent,
    );

    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Agent-Type': result.agent_type,
    });

    const reader = result.stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      // Client disconnected or stream error
    } finally {
      reader.releaseLock();
      res.end();
    }
  }
}
