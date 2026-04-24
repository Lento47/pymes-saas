import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  // ── Public (no auth) ──────────────────────────────────────────────────────

  /** GET /invitations/verify?token=... — pre-fills accept page. */
  @Get('verify')
  verify(@Query('token') token: string) {
    return this.service.getByToken(token);
  }

  /** POST /invitations/accept — accept + issue tokens. */
  @Post('accept')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.service.accept(dto);
  }

  // ── Admin (JWT + ADMIN/OWNER) ─────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'OWNER')
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.workspace_id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'OWNER')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvitationDto) {
    return this.service.create(user.workspace_id, user, dto);
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'OWNER')
  resend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resend(user.workspace_id, user, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'OWNER')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.revoke(user.workspace_id, user, id);
  }
}
