import { WorkspaceUserRole } from "@prisma/client";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { WebhookEventsService } from "./webhook-events.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin/webhooks")
export class WebhookSyncController {
  constructor(private readonly webhookEvents: WebhookEventsService) {}

  @Get("sync-status")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  getSyncStatus() {
    return this.webhookEvents.getSyncStatus();
  }
}
