import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { FilterConversationsDto } from './dto/filter-conversations.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  constructor(
    private readonly service: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  // ── Conversations ──────────────────────────────────────────────────────────

  @Get()
  findAll(
    @CurrentUser('workspace_id') workspaceId: string,
    @Query() filters: FilterConversationsDto,
  ) {
    return this.service.findAll(workspaceId, filters);
  }

  @Post()
  @Roles('AGENT' as any)
  create(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateConversationDto,
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
  @Roles('AGENT' as any)
  update(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Post(':id/assign')
  @Roles('AGENT' as any)
  assign(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
    @Body('user_id') userId: string,
  ) {
    return this.service.assign(workspaceId, id, userId);
  }

  @Post(':id/resolve')
  @Roles('AGENT' as any)
  resolve(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.resolve(workspaceId, id);
  }

  @Delete(':id')
  @Roles('AGENT' as any)
  remove(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  @Get(':id/messages')
  getMessages(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') conversationId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.messagesService.findAll(workspaceId, conversationId, +page, +limit);
  }

  @Post(':id/messages')
  @Roles('AGENT' as any)
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.send(user.workspace_id, conversationId, user, dto);
  }
}
