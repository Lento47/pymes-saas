import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { AssignMemberDto } from './dto/assign-member.dto';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdatePlatformUserPasswordDto } from './dto/update-platform-user-password.dto';
import { UpdatePlatformUserStatusDto } from './dto/update-platform-user-status.dto';
import { UpdateWorkspaceBillingDto } from './dto/update-workspace-billing.dto';
import { UpdateWorkspaceFeaturesDto } from './dto/update-workspace-features.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @Get('workspaces')
  listWorkspaces() {
    return this.service.listWorkspaces();
  }

  @Get('workspaces/:slug/members')
  listMembers(@Param('slug') slug: string) {
    return this.service.listMembers(slug);
  }

  @Get('workspaces/:slug/billing')
  getWorkspaceBilling(@Param('slug') slug: string) {
    return this.service.getWorkspaceBilling(slug);
  }

  @Post('workspaces/:slug/members')
  assignMember(@Param('slug') slug: string, @Body() dto: AssignMemberDto) {
    return this.service.assignMember(slug, dto);
  }

  @Patch('workspaces/:slug/members/:userId/role')
  updateMemberRole(
    @Param('slug') slug: string,
    @Param('userId', ValidateUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.service.updateMemberRole(slug, userId, dto);
  }

  @Delete('workspaces/:slug/members/:userId')
  removeMember(@Param('slug') slug: string, @Param('userId', ValidateUUIDPipe) userId: string) {
    return this.service.removeMember(slug, userId);
  }

  @Patch('workspaces/:slug/billing')
  updateWorkspaceBilling(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateWorkspaceBillingDto,
  ) {
    return this.service.updateWorkspaceBilling(slug, user.id, dto);
  }

  @Get('workspaces/:slug/features')
  getWorkspaceFeatures(@Param('slug') slug: string) {
    return this.service.getWorkspaceFeatures(slug);
  }

  @Patch('workspaces/:slug/features')
  updateWorkspaceFeatures(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateWorkspaceFeaturesDto,
  ) {
    return this.service.updateWorkspaceFeatures(slug, user.id, dto);
  }

  @Get('users')
  searchUsers(@Query('email') email?: string) {
    return this.service.searchUsers(email);
  }

  @Post('users')
  createUser(@Body() dto: CreatePlatformUserDto) {
    return this.service.createUser(dto);
  }

  @Patch('users/:userId/password')
  updateUserPassword(
    @Param('userId', ValidateUUIDPipe) userId: string,
    @Body() dto: UpdatePlatformUserPasswordDto,
  ) {
    return this.service.updateUserPassword(userId, dto.password);
  }

  @Post('users/:userId/reset-password')
  resetUserPassword(@Param('userId', ValidateUUIDPipe) userId: string) {
    return this.service.resetUserPassword(userId);
  }

  @Patch('users/:userId/status')
  updateUserStatus(
    @Param('userId', ValidateUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePlatformUserStatusDto,
  ) {
    return this.service.updateUserStatus(userId, user.id, dto.status);
  }

  @Patch('users/:userId/toggle-admin')
  togglePlatformAdmin(@Param('userId', ValidateUUIDPipe) userId: string) {
    return this.service.togglePlatformAdmin(userId);
  }

  @Delete('users/:userId')
  deleteUser(@Param('userId', ValidateUUIDPipe) userId: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteUser(userId, user.id);
  }

  @Delete('workspaces/:slug')
  async deleteWorkspace(@Param('slug') slug: string) {
    return this.service.deleteWorkspace(slug);
  }

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get('workspaces/:slug')
  getWorkspaceBySlug(@Param('slug') slug: string) {
    return this.service.getWorkspaceBySlug(slug);
  }
}
