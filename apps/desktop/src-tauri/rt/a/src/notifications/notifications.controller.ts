import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  @Roles('VIEWER', 'AGENT', 'ADMIN', 'OWNER')
  findAll(
    @CurrentUser() user: any,
    @Query() filters: FilterNotificationsDto,
  ) {
    return this.notificationsService.findAll(
      user.workspaceId,
      user.id,
      filters,
    );
  }

  @Get('unread-count')
  @Roles('VIEWER', 'AGENT', 'ADMIN', 'OWNER')
  getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(
      user.workspaceId,
      user.id,
    );
  }

  @Post('mark-read')
  @Roles('VIEWER', 'AGENT', 'ADMIN', 'OWNER')
  markRead(
    @CurrentUser() user: any,
    @Body() dto: MarkReadDto,
  ) {
    return this.notificationsService.markRead(
      user.workspaceId,
      user.id,
      dto,
    );
  }

  @Delete('old')
  @Roles('ADMIN', 'OWNER')
  deleteOld(@CurrentUser() user: any) {
    return this.notificationsService.deleteOld(user.workspaceId);
  }
}
