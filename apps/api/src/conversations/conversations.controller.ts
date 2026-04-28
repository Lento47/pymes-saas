import { WorkspaceUserRole } from '@prisma/client';
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { SlaService } from './sla.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
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
    private readonly slaService: SlaService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Conversations ──────────────────────────────────────────────────────────

  @Get('sla/stats')
  @Roles(WorkspaceUserRole.AGENT)
  getSlaStats(@CurrentUser('workspace_id') workspaceId: string) {
    return this.slaService.getSlaStats(workspaceId);
  }

  @Post('sla/check')
  @Roles(WorkspaceUserRole.ADMIN)
  async checkSla(@CurrentUser('workspace_id') workspaceId: string) {
    await this.slaService.checkSlaBreaches(workspaceId);
    return { ok: true };
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() filters: FilterConversationsDto,
  ) {
    return this.service.findAll(user.workspace_id, filters, { id: user.id, role: user.role });
  }

  @Post()
  @Roles(WorkspaceUserRole.AGENT)
  create(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  @Patch(':id')
  @Roles(WorkspaceUserRole.AGENT)
  update(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Post(':id/assign')
  @Roles(WorkspaceUserRole.AGENT)
  assign(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body('user_id') userId: string,
  ) {
    return this.service.assign(workspaceId, id, userId);
  }

  @Post(':id/resolve')
  @Roles(WorkspaceUserRole.AGENT)
  resolve(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.service.resolve(workspaceId, id);
  }

  @Delete(':id')
  @Roles(WorkspaceUserRole.ADMIN)
  remove(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  @Get(':id/messages')
  getMessages(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) conversationId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.messagesService.findAll(workspaceId, conversationId, +page, +limit);
  }

  @Post(':id/messages')
  @Roles(WorkspaceUserRole.AGENT)
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ValidateUUIDPipe) conversationId: string,
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

    if (conv?.channel?.type === 'WHATSAPP' && (conv.contact as any)?.phone) {
      try {
        // Strip non-digits and leading + so Meta receives e.g. "50672134886"
        const to = ((conv.contact as any).phone as string).replace(/\D/g, '');
        await this.whatsAppService.sendMessage(conv.channel, to, dto.body_text ?? '');
      } catch (err: any) {
        this.logger.error(`WhatsApp dispatch failed: ${err?.message}`);
      }
    }

    return message;
  }
}
