import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { WorkspaceUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CustomerMemoryService } from "./customer-memory.service";
import { BusinessMemoryService } from "./business-memory.service";
import { ConversationInsightService } from "./conversation-insight.service";
import { OutcomeTrackerService } from "./outcome-tracker.service";
import { PlaybookEngineService } from "./playbook-engine.service";
import { RecordFeedbackDto } from "./dto/record-feedback.dto";
import { UpdateBusinessMemoryDto } from "./dto/update-business-memory.dto";

const ALL_ROLES = [
  WorkspaceUserRole.VIEWER,
  WorkspaceUserRole.AGENT,
  WorkspaceUserRole.ADMIN,
  WorkspaceUserRole.OWNER,
];

const ADMIN_ROLES = [WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER];

@Controller("learning")
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningController {
  constructor(
    private readonly customerMemory: CustomerMemoryService,
    private readonly businessMemory: BusinessMemoryService,
    private readonly conversationInsight: ConversationInsightService,
    private readonly outcomeTracker: OutcomeTrackerService,
    private readonly playbookEngine: PlaybookEngineService,
  ) {}

  @Get("customer/:contactId")
  @Roles(...ALL_ROLES)
  getCustomerMemory(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("contactId") contactId: string,
  ) {
    return this.customerMemory.getOrCreate(workspaceId, contactId);
  }

  @Get("business")
  @Roles(...ALL_ROLES)
  getBusinessMemory(@CurrentUser("workspace_id") workspaceId: string) {
    return this.businessMemory.getOrCreate(workspaceId);
  }

  @Patch("business")
  @Roles(...ADMIN_ROLES)
  updateBusinessMemory(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() dto: UpdateBusinessMemoryDto,
  ) {
    return this.businessMemory.update(workspaceId, dto);
  }

  @Get("conversations/:conversationId/insight")
  @Roles(...ALL_ROLES)
  getConversationInsight(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationInsight.getOrCreate(workspaceId, conversationId);
  }

  @Post("feedback")
  @Roles(WorkspaceUserRole.AGENT, ...ADMIN_ROLES)
  recordFeedback(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() dto: RecordFeedbackDto,
  ) {
    return this.outcomeTracker.record({ workspace_id: workspaceId, ...dto });
  }

  @Get("playbooks")
  @Roles(...ALL_ROLES)
  listPlaybooks(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("status") status?: string,
  ) {
    return this.playbookEngine.listSuggestions(
      workspaceId,
      status as "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | undefined,
    );
  }

  @Patch("playbooks/:id")
  @Roles(...ADMIN_ROLES)
  updatePlaybookStatus(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
    @Body("status") status: "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE",
  ) {
    return this.playbookEngine.updateStatus(workspaceId, id, status);
  }
}
