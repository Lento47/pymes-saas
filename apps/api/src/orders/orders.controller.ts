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
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { OrdersService } from "./orders.service";
import { CreateOrderDto, UpdateOrderDto } from "./dto/create-order.dto";

@Controller("orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Stats (dashboard) ─────────────────────────────────────────────────────

  @Get("stats")
  @Roles(WorkspaceUserRole.AGENT)
  getStats(@CurrentUser("workspace_id") workspaceId: string) {
    return this.ordersService.getStats(workspaceId);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Get()
  @Roles(WorkspaceUserRole.AGENT)
  list(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    return this.ordersService.list(workspaceId, { status, search });
  }

  @Get(":id")
  @Roles(WorkspaceUserRole.AGENT)
  getById(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
  ) {
    return this.ordersService.getById(workspaceId, id);
  }

  @Post()
  @Roles(WorkspaceUserRole.AGENT)
  create(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(workspaceId, dto);
  }

  @Patch(":id")
  @Roles(WorkspaceUserRole.AGENT)
  update(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(workspaceId, id, dto);
  }

  // ── Status transitions ───────────────────────────────────────────────────

  @Post(":id/process")
  @Roles(WorkspaceUserRole.AGENT)
  markProcessing(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
  ) {
    return this.ordersService.markProcessing(workspaceId, id);
  }

  @Post(":id/complete")
  @Roles(WorkspaceUserRole.AGENT)
  markCompleted(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
  ) {
    return this.ordersService.markCompleted(workspaceId, id);
  }

  @Post(":id/cancel")
  @Roles(WorkspaceUserRole.AGENT)
  markCancelled(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
    @Body("reason") reason?: string,
  ) {
    return this.ordersService.markCancelled(workspaceId, id, reason);
  }

  @Post(":id/reopen")
  @Roles(WorkspaceUserRole.AGENT)
  reopen(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
  ) {
    return this.ordersService.reopen(workspaceId, id);
  }
}
