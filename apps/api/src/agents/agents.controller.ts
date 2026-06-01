import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { WorkspaceUserRole, AgentChannelScope } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { AgentsService } from "./agents.service";
import { AgentRuntimeService } from "./runtime/agent-runtime.service";
import { SupportOrchestratorService } from "./support/support-orchestrator.service";
import { FlowiseSetupService } from "./flowise-setup.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";
import { TestAgentDto } from "./dto/test-agent.dto";
import { OrchestrateSupportDto } from "./dto/orchestrate-support.dto";

@Controller("agents")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly runtime: AgentRuntimeService,
    private readonly orchestrator: SupportOrchestratorService,
    private readonly flowiseSetup: FlowiseSetupService,
  ) {}

  // NOTE: /support routes must be declared before /:id to avoid route shadowing
  @Post("support/orchestrate")
  @Roles(
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  orchestrateSupport(
    @CurrentUser() user: AuthUser,
    @Body() dto: OrchestrateSupportDto,
  ) {
    return this.orchestrator.orchestrate({
      workspace_id: user.workspace_id,
      message: dto.message,
      diagnostic_case_id: dto.diagnostic_case_id,
      allow_pr_creation: dto.allow_pr_creation,
      triggered_by_user_id: user.id,
    });
  }

  @Post("support/orchestrate/:id/continue")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  continueOrchestration(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body("answer") answer: string,
  ) {
    return this.orchestrator.continueWithClarification(user.workspace_id, id, answer);
  }

  @Get("support/runs")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  listSupportRuns(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("limit") limit?: string,
  ) {
    return this.orchestrator.listRuns(workspaceId, limit ? Number(limit) : undefined);
  }

  @Get("support/runs/:id")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  getSupportRun(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
  ) {
    return this.orchestrator.getRun(workspaceId, id);
  }

  @Get()
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  listAgents(@CurrentUser("workspace_id") workspaceId: string) {
    return this.agentsService.listAgents(workspaceId);
  }

  @Post()
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  createAgent(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() dto: CreateAgentDto,
  ) {
    return this.agentsService.createAgent(workspaceId, dto);
  }

  // NOTE: /templates must be declared before /:id to avoid route shadowing
  @Get("templates")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  listTemplates() {
    return this.agentsService.listTemplates();
  }

  @Post("templates/:id/install")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  installTemplate(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.agentsService.installTemplate(workspaceId, id);
  }

  @Get(":id")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  getAgent(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.agentsService.getAgent(workspaceId, id);
  }

  @Patch(":id")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  updateAgent(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.agentsService.updateAgent(workspaceId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  deleteAgent(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.agentsService.deleteAgent(workspaceId, id);
  }

  @Post(":id/test")
  @Roles(
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  async testAgent(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: TestAgentDto,
  ) {
    const ensured = await this.agentsService.ensureFlowiseChatflow(workspaceId, id);

    try {
      const result = await this.runtime.run({
        agent_instance_id: id,
        workspace_id: workspaceId,
        question: dto.question,
        channel: dto.channel ?? AgentChannelScope.WEB,
        flowise_session_id: dto.flowise_session_id,
      });

      return ensured.reprovisioned
        ? {
            ...result,
            reprovisioned: true,
            old_chatflow_id: ensured.old_chatflow_id,
            new_chatflow_id: ensured.new_chatflow_id,
          }
        : result;
    } catch (err) {
      if (this.isMissingFlowiseChatflowError(err)) {
        const healed = await this.agentsService.ensureFlowiseChatflow(workspaceId, id, { force: true });
        const retry = await this.runtime.run({
          agent_instance_id: id,
          workspace_id: workspaceId,
          question: dto.question,
          channel: dto.channel ?? AgentChannelScope.WEB,
          flowise_session_id: dto.flowise_session_id,
        });

        return {
          ...retry,
          reprovisioned: true,
          old_chatflow_id: healed.old_chatflow_id,
          new_chatflow_id: healed.new_chatflow_id,
        };
      }

      throw err;
    }
  }

  @Post(":id/reprovision")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  reprovision(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.agentsService.reprovisionChatflow(workspaceId, id);
  }

  @Post(":id/activate")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  activate(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.agentsService.setStatus(workspaceId, id, "ACTIVE");
  }

  @Post(":id/deactivate")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  deactivate(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.agentsService.setStatus(workspaceId, id, "INACTIVE");
  }

  /** Force-rebuild all Flowise agentflows without redeploying. OWNER only. */
  @Post("admin/flowise-rebuild")
  @Roles(WorkspaceUserRole.OWNER)
  async adminFlowiseRebuild() {
    return this.flowiseSetup.reprovisionAllFlows();
  }

  private isMissingFlowiseChatflowError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return (
      message.includes("Flowise returned 404") &&
      message.includes("Chatflow") &&
      message.includes("not found in the database")
    );
  }
}
