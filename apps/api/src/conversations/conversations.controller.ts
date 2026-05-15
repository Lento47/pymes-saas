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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { SlaService } from './sla.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { TelegramService } from '../telegram/telegram.service';
import { MessageTemplatesService } from '../message-templates/message-templates.service';
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
    private readonly telegramService: TelegramService,
    private readonly templatesService: MessageTemplatesService,
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
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
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
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
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
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
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
    let bodyText = dto.body_text ?? '';
    let bodyHtml = dto.body_html ?? '';
    let template: any = null;

    if (dto.template_id) {
      template = await this.templatesService.getById(user.workspace_id, dto.template_id);
      if (template) {
        bodyText = this.resolveTemplate(template.body, dto.template_variables ?? {});
        bodyHtml = bodyText.replace(/\n/g, '<br>');
      }
    }

    const sendDto = { ...dto, body_text: bodyText, body_html: bodyHtml };
    const message = await this.messagesService.send(
      user.workspace_id,
      conversationId,
      user,
      sendDto,
    );

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
          bodyHtml || bodyText,
          bodyText,
        );
      } catch (err: any) {
        this.logger.error(`Email dispatch failed: ${err?.message}`);
      }
    }

    if (conv?.channel?.type === 'WHATSAPP' && (conv.contact as any)?.phone) {
      try {
        const to = ((conv.contact as any).phone as string).replace(/\D/g, '');
        this.logger.log(`[DIAG] WhatsApp dispatch: conv=${conversationId}, channel=${conv.channel.id}, phone=${to}`);
        if (dto.media_url && dto.media_type) {
          await this.whatsAppService.sendMedia(conv.channel, to, dto.media_url, dto.media_type as 'image' | 'document', dto.body_text || undefined);
        } else if (template?.external_template_id) {
          await this.whatsAppService.sendTemplateMessage(
            conv.channel,
            to,
            template.external_template_id,
            template.language ?? 'es',
            dto.template_variables ?? {},
          );
        } else {
          await this.whatsAppService.sendMessage(conv.channel, to, bodyText);
        }
      } catch (err: any) {
        this.logger.error(`WhatsApp dispatch failed: ${err?.message}`);
      }
    }

    if (conv?.channel?.type === 'TELEGRAM' && (conv.contact as any)?.telegram_chat_id) {
      try {
        await this.telegramService.sendMessage(
          conv.channel.id,
          (conv.contact as any).telegram_chat_id,
          bodyText,
        );
      } catch (err: any) {
        this.logger.error(`Telegram dispatch failed: ${err?.message}`);
      }
    }

    return message;
  }

  private resolveTemplate(body: string, vars: Record<string, string>): string {
    let resolved = body;
    for (const [key, value] of Object.entries(vars)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return resolved;
  }

  @Get('messages/:messageId/media')
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  async getMessageMedia(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('messageId', ValidateUUIDPipe) messageId: string,
    @Res() res: Response,
  ) {
    try {
      // 1) Try signed URL redirect (MinIO storage — no proxy)
      const signedUrl = await this.messagesService.getMediaSignedUrl(messageId, workspaceId);
      if (signedUrl) {
        const ttlSeconds = Number(process.env.MEDIA_SIGNED_URL_TTL_SECONDS ?? 300);
        res.setHeader('Cache-Control', `private, max-age=${ttlSeconds}`);
        return res.redirect(302, signedUrl);
      }

      // 2) Fallback: buffer proxy (Meta API — no storage yet)
      const { buffer, contentType } = await this.whatsAppService.downloadMedia(messageId, workspaceId);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.send(buffer);
    } catch (err: any) {
      res.status(404).json({ statusCode: 404, message: err.message || 'Media no disponible' });
    }
  }
}