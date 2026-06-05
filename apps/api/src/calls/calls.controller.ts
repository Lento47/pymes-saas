import { WorkspaceUserRole } from "@prisma/client";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { RequirePermission, Permission } from "../common/permissions";
import { FeatureFlagGuard, RequireFeature } from "../feature-flags/feature-flags.guard";
import { CallsService } from "./calls.service";
import { RingCallDto } from "./dto/ring-call.dto";
import { IceCandidateDto } from "./dto/ice-candidate.dto";
import { CallRateLimitGuard } from "./call-rate-limit.guard";

@Controller("calls")
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
@RequireFeature("calls")
@RequirePermission(Permission.CONVERSATIONS_READ)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post("ring")
  @UseGuards(CallRateLimitGuard)
  @RequirePermission(Permission.CONVERSATIONS_REPLY)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async ring(@Body() dto: RingCallDto, @CurrentUser() user: AuthUser) {
    return this.callsService.ring(user.workspace_id, user.id, dto);
  }

  @Post(":id/answer")
  @RequirePermission(Permission.CONVERSATIONS_REPLY)
  async answer(
    @Param("id", ValidateUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.callsService.answer(id, user.id);
  }

  @Post(":id/reject")
  @RequirePermission(Permission.CONVERSATIONS_REPLY)
  async reject(
    @Param("id", ValidateUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.callsService.reject(id, user.id);
  }

  @Post(":id/end")
  @RequirePermission(Permission.CONVERSATIONS_REPLY)
  async end(
    @Param("id", ValidateUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.callsService.end(id, user.id);
  }

  @Post(":id/ice")
  @RequirePermission(Permission.CONVERSATIONS_REPLY)
  async addIce(
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: IceCandidateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.callsService.addIceCandidate(id, user.id, dto);
  }

  @Get(":id")
  async getCall(@Param("id", ValidateUUIDPipe) id: string) {
    return this.callsService.getCall(id);
  }
}
