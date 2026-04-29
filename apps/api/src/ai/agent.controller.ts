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
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

@Controller('agent')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly toolsService: AgentToolsService,
    private readonly planLimits: PlanLimitsService,
  ) {} 

  @Post('execute')
  @Roles('ADMIN', 'AGENT', 'VIEWER')
  executeTool(
    @Body() body: { tool: string; arguments?: Record<string, any> },
    @CurrentUser('workspace_id') workspaceId: string,
  ) {
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
    await this.planLimits.enforcePlanTier(workspaceId, 'ENTERPRISE', 'HubbyAgent');
    const input = dto.message || dto.input;
    const conversationId = dto.conversationId || dto.conversation_id;
    const result = await this.agentService.streamWorkflow(
      workspaceId,
      input,
      conversationId,
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
