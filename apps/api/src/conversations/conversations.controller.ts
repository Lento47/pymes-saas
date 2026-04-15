import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { FilterConversationsDto } from './dto/filter-conversations.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    private readonly service: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
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
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    // 1. Guardar mensaje en DB
    const message = await this.messagesService.send(
      user.workspace_id,
      conversationId,
      user,
      dto,
    );

    // 2. Despachar al canal externo si aplica
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: user.workspace_id },
      include: { contact: true, channel: true },
    });

    if (conv?.channel?.type === 'EMAIL' && (conv.contact as any)?.email) {
      try {
        await this.emailService.sendOutbound(
          conv.channel,
          (conv.contact as any).email,
          (conv as any).subject ?? 'Nuevo mensaje',
          dto.body_html ?? dto.body_text ?? '',
          dto.body_text,
        );
      } catch (err: any) {
        this.logger.error(`Email dispatch failed: ${err?.message}`);
      }
    }

    return message;
  }
}
