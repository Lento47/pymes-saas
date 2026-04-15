import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('channels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChannelsController {
  constructor(private readonly service: ChannelsService) {}

  @Get()
  findAll(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  @Post()
  @Roles('ADMIN' as any)
  create(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  @Patch(':id')
  @Roles('ADMIN' as any)
  update(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Post(':id/connect')
  @Roles('ADMIN' as any)
  connect(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.connect(workspaceId, id);
  }

  @Post(':id/disconnect')
  @Roles('ADMIN' as any)
  disconnect(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.disconnect(workspaceId, id);
  }

  @Delete(':id')
  @Roles('ADMIN' as any)
  remove(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }
}
