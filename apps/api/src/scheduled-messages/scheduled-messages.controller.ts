import {
  Controller, Get, Post, Delete, Param, Body, UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { WorkspaceUserRole } from "@prisma/client";
import { IsNotEmpty, IsString, IsDateString } from "class-validator";
import { ScheduledMessagesService } from "./scheduled-messages.service";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";

class CreateScheduledMessageDto {
  @IsString() @IsNotEmpty()
  body_text!: string;

  @IsDateString()
  scheduled_at!: string;

  @IsString() @IsNotEmpty()
  source!: string;

  context_note?: string;
}

@Controller("api/conversations/:conversationId/scheduled-messages")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduledMessagesController {
  constructor(private readonly service: ScheduledMessagesService) {}

  @Get()
  @Roles(WorkspaceUserRole.AGENT)
  list(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("conversationId", ValidateUUIDPipe) conversationId: string,
  ) {
    return this.service.listByConversation(workspaceId, conversationId);
  }

  @Post()
  @Roles(WorkspaceUserRole.AGENT)
  async create(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("conversationId", ValidateUUIDPipe) conversationId: string,
    @Body() dto: CreateScheduledMessageDto,
  ) {
    await this.service.schedule({
      workspaceId,
      conversationId,
      bodyText: dto.body_text,
      scheduledAt: new Date(dto.scheduled_at),
      source: dto.source as any,
      contextNote: dto.context_note,
    });
    return { ok: true };
  }

  @Delete(":id")
  @Roles(WorkspaceUserRole.AGENT)
  async cancel(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
  ) {
    const cancelled = await this.service.cancel(workspaceId, id);
    return { ok: cancelled };
  }
}
