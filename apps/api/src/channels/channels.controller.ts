import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ConfigureEmailDto } from './dto/configure-email.dto';

// ── Guards / decorators (assumed to exist in your project) ────────────────────
// Adjust import paths to match your actual auth implementation.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { IAuthUser } from '../auth/interfaces/auth-user.interface';

// ─────────────────────────────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * POST /channels
   * Create a new channel (ADMIN only).
   */
  @Post()
  @Roles('ADMIN')
  create(
    @AuthUser() user: IAuthUser,
    @Body() body: { type: string; name: string; provider?: string },
  ) {
    return this.channelsService.create(user.workspace_id, body);
  }

  /**
   * GET /channels
   * List all channels for the current workspace.
   */
  @Get()
  findAll(@AuthUser() user: IAuthUser) {
    return this.channelsService.findAll(user.workspace_id);
  }

  /**
   * GET /channels/:id
   * Get a single channel.
   */
  @Get(':id')
  findOne(@AuthUser() user: IAuthUser, @Param('id') id: string) {
    return this.channelsService.findOne(user.workspace_id, id);
  }

  /**
   * PATCH /channels/:id
   * Update channel name or status (ADMIN only).
   */
  @Patch(':id')
  @Roles('ADMIN')
  update(
    @AuthUser() user: IAuthUser,
    @Param('id') id: string,
    @Body() body: { name?: string; status?: string },
  ) {
    return this.channelsService.update(user.workspace_id, id, body);
  }

  /**
   * DELETE /channels/:id
   * Remove a channel (ADMIN only).
   */
  @Delete(':id')
  @Roles('ADMIN')
  remove(@AuthUser() user: IAuthUser, @Param('id') id: string) {
    return this.channelsService.remove(user.workspace_id, id);
  }

  // ── Email-specific ────────────────────────────────────────────────────────

  /**
   * POST /channels/:id/configure-email
   *
   * Configure a channel of type EMAIL with Resend credentials.
   * The api_key is encrypted with AES-256-GCM before being persisted and
   * is NEVER returned in any API response.
   *
   * Body: ConfigureEmailDto { api_key, from_email, from_name }
   * Role: ADMIN
   */
  @Post(':id/configure-email')
  @Roles('ADMIN')
  configureEmail(
    @AuthUser() user: IAuthUser,
    @Param('id') id: string,
    @Body() dto: ConfigureEmailDto,
  ) {
    return this.channelsService.configureEmail(user.workspace_id, id, dto);
  }
}
