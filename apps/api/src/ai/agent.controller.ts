import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
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

@Controller('agent')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly toolsService: AgentToolsService,
    private readonly planLimits: PlanLimitsService,
    private readonly prisma: PrismaService,
    private readonly router: SupportRouterService,
  ) {} 

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
