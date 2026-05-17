import { WorkspaceUserRole } from '@prisma/client';
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { NotificationsService } from './notifications.service';
import { FilterNotificationsDto } from './dto/filter-notifications.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  findAll(
    @CurrentUser() user: Record<string, any>,
    @Query() filters: FilterNotificationsDto,
  ) {
    return this.notificationsService.findAll(
      user.workspaceId,
      user.id,
      filters,
    );
  }

  @Get('unread-count')
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  getUnreadCount(@CurrentUser() user: Record<string, any>) {
    return this.notificationsService.getUnreadCount(
      user.workspaceId,
      user.id,
    );
  }

  @Post('mark-read')
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  markRead(
    @CurrentUser() user: Record<string, any>,
    @Body() dto: MarkReadDto,
  ) {
    return this.notificationsService.markRead(
      user.workspaceId,
      user.id,
      dto,
    );
  }

  @Delete('old')
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  deleteOld(@CurrentUser() user: Record<string, any>) {
    return this.notificationsService.deleteOld(user.workspaceId);
  }
}
