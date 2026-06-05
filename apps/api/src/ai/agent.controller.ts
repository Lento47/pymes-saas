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
} from "@nestjs/common";
import { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermission, Permission } from "../common/permissions";
import { AgentService } from "./agent.service";
import { AgentToolsService } from "./agent-tools.service";
import { AgentStreamDto } from "./agent.dto";
import { CreateEscalationDto } from "./agent-escalation.dto";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { SupportRouterService } from "./support-router.service";
import { DiagnosticService } from "./diagnostic.service";
import { EngineeringFixService } from "./engineering-fix.service";
import { CaseCommentsService } from "./case-comments.service";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";

@Controller("agent")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission(Permission.AI_USE)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly toolsService: AgentToolsService,
    private readonly planLimits: PlanLimitsService,
    private readonly prisma: PrismaService,
    private readonly router: SupportRouterService,
    private readonly diagnostic: DiagnosticService,
    private readonly fixService: EngineeringFixService,
    private readonly caseComments: CaseCommentsService,
  ) {}

  // ADMINs see every case in the workspace. AGENT/VIEWER see only the
  // cases they personally triggered (auto-opened from their requests or
  // explicitly escalated by them) so they can track their own tickets.
  @Get("diagnostic-cases")
  @Roles("ADMIN", "AGENT", "VIEWER")
  async listDiagnosticCases(
    @CurrentUser()
    user: {
      id: string;
      workspace_id: string;
      role: string;
      is_platform_admin: boolean;
    },
  ) {
    const seesAll = user.role === "ADMIN" || user.is_platform_admin;
    return this.diagnostic.listCases(user.workspace_id, seesAll ? undefined : { userId: user.id });
  }

  @Get("diagnostic-cases/:id")
  @Roles("ADMIN", "AGENT", "VIEWER")
  async getDiagnosticCase(
    @Param("id", ValidateUUIDPipe) id: string,
    @CurrentUser()
    user: { id: string; workspace_id: string; role: string; is_platform_admin: boolean },
  ) {
    const seesAll = user.role === "ADMIN" || user.is_platform_admin;
    // Non-admins only see their own cases; return 404 (not 403) to avoid
    // revealing whether a case for another user exists.
    const case_ = await this.diagnostic.getCase(id, {
      workspaceId: user.workspace_id,
      userId: seesAll ? undefined : user.id,
    });
    if (!case_) throw new NotFoundException("Diagnostic case not found");
    // ADMIN gets the engineering view (selectable fields for fix workflow).
    if (seesAll) {
      return this.fixService.getDiagnosticCaseForFix(id);
    }
    return case_;
  }

  @Patch("diagnostic-cases/:id/status")
  @Roles("ADMIN")
  async updateDiagnosticCaseStatus(
    @Param("id", ValidateUUIDPipe) id: string,
    @Body("status") status: string,
    @CurrentUser() user: { id: string; workspace_id: string; is_platform_admin: boolean },
  ) {
    return this.diagnostic.updateCaseStatus(id, status, {
      workspaceId: user.workspace_id,
      isPlatformAdmin: user.is_platform_admin,
    });
  }

  @Patch("fix-cases/:id")
  @Roles("ADMIN")
  async updateFixCase(
    @Param("id", ValidateUUIDPipe) fixCaseId: string,
    @Body()
    body: {
      status?: string;
      pr_url?: string;
      pr_number?: number;
      files_changed?: Record<string, any>;
      test_added?: Record<string, any>;
      fix_summary?: string;
      rollback_notes?: string;
      error_log?: string;
    },
    @CurrentUser() user: { id: string; workspace_id: string; is_platform_admin: boolean },
  ) {
    return this.fixService.updateFixStatus(fixCaseId, body, {
      workspaceId: user.workspace_id,
      isPlatformAdmin: user.is_platform_admin,
    });
  }

  @Post("fix-cases")
  @Roles("ADMIN")
  async createFixCase(
    @Body("diagnostic_case_id") diagnosticCaseId: string,
    @CurrentUser() user: { id: string; workspace_id: string; is_platform_admin: boolean },
  ) {
    return this.fixService.createFixCase(diagnosticCaseId, {
      workspaceId: user.workspace_id,
      isPlatformAdmin: user.is_platform_admin,
    });
  }

  @Post("fix-cases/:id/approve")
  @Roles("ADMIN")
  async approveFixCase(
    @Param("id", ValidateUUIDPipe) fixCaseId: string,
    @CurrentUser() user: { id: string; workspace_id: string; is_platform_admin: boolean },
  ) {
    return this.fixService.approveFix(fixCaseId, {
      workspaceId: user.workspace_id,
      isPlatformAdmin: user.is_platform_admin,
    });
  }

  @Post("fix-cases/:id/reject")
  @Roles("ADMIN")
  async rejectFixCase(
    @Param("id", ValidateUUIDPipe) fixCaseId: string,
    @Body("reason") reason: string,
    @CurrentUser() user: { id: string; workspace_id: string; is_platform_admin: boolean },
  ) {
    return this.fixService.rejectFix(fixCaseId, reason, {
      workspaceId: user.workspace_id,
      isPlatformAdmin: user.is_platform_admin,
    });
  }

  @Get("fix-cases")
  @Roles("ADMIN")
  async listFixCases(@CurrentUser("workspace_id") workspaceId: string) {
    return this.fixService.listFixCases(workspaceId);
  }

  @Get("fix-cases/:id")
  @Roles("ADMIN")
  async getFixCase(
    @Param("id", ValidateUUIDPipe) fixCaseId: string,
    @CurrentUser() user: { id: string; workspace_id: string; is_platform_admin: boolean },
  ) {
    return this.fixService.getFixCase(fixCaseId, {
      workspaceId: user.workspace_id,
      isPlatformAdmin: user.is_platform_admin,
    });
  }

  @Get("diagnostic-cases/:id/comments")
  @Roles("ADMIN", "AGENT", "VIEWER")
  async listComments(
    @Param("id", ValidateUUIDPipe) caseId: string,
    @CurrentUser("workspace_id") workspaceId: string,
  ) {
    return this.caseComments.findByCaseId(caseId);
  }

  @Post("diagnostic-cases/:id/comments")
  @Roles("ADMIN")
  async createComment(
    @Param("id", ValidateUUIDPipe) caseId: string,
    @Body("body") body: string,
    @CurrentUser("workspace_id") workspaceId: string,
    @CurrentUser("id") userId: string,
  ) {
    return this.caseComments.create(caseId, workspaceId, userId, body);
  }

  @Post("diagnose")
  @Roles("ADMIN", "AGENT", "VIEWER")
  async diagnose(
    @Body()
    body: { module: string; error_code?: string; trace_id?: string; user_description?: string },
    @CurrentUser("workspace_id") workspaceId: string,
    @CurrentUser("id") userId: string,
  ) {
    await this.planLimits.enforceDiagnosticLimit(workspaceId);
    const result = await this.diagnostic.diagnose({
      workspaceId,
      userId,
      module: body.module || "unknown",
      error_code: body.error_code,
      trace_id: body.trace_id,
      user_description: body.user_description,
    });
    return result;
  }

  @Post("escalate")
  @Roles("ADMIN", "AGENT", "VIEWER")
  async escalate(
    @Body() dto: CreateEscalationDto,
    @CurrentUser("workspace_id") workspaceId: string,
    @CurrentUser("id") userId: string,
  ) {
    await this.planLimits.enforceAiAccess(workspaceId);

    const escalation = await this.prisma.agentEscalation.create({
      data: {
        workspace_id: workspaceId,
        user_id: userId,
        summary: dto.summary,
        severity: dto.severity || "MEDIUM",
        evidence_json: (dto.evidence as any) || undefined,
        status: "OPEN",
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

  @Post("execute")
  @Roles("ADMIN", "AGENT", "VIEWER")
  async executeTool(
    @Body() body: { tool: string; arguments?: Record<string, any> },
    @CurrentUser("workspace_id") workspaceId: string,
  ) {
    await this.planLimits.enforceAiAccess(workspaceId);
    return this.toolsService.execute(workspaceId, body.tool, body.arguments || {});
  }

  @Post("stream")
  @Roles("ADMIN", "AGENT", "VIEWER")
  async stream(
    @Body() dto: AgentStreamDto,
    @CurrentUser("workspace_id") workspaceId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.planLimits.enforceAiAccess(workspaceId);
    const input = dto.message || dto.input;
    if (!input || typeof input !== "string") {
      res.status(400).json({ error: "Se requiere message o input" });
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

    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Agent-Type": result.agent_type,
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
