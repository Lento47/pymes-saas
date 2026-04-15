import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { MessagesService } from '../messages/messages.service';

// ── Guards / decorators (assumed to exist in your project) ────────────────────
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { IAuthUser } from '../auth/interfaces/auth-user.interface';

// ─────────────────────────────────────────────────────────────────────────────

interface SendMessageDto {
  body_text?: string;
  body_html?: string;
  subject?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('conversations')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly emailService: EmailService,
  ) {}

  // ── Conversations ─────────────────────────────────────────────────────────

  /**
   * GET /conversations
   * List conversations for the current workspace.
   */
  @Get()
  findAll(@AuthUser() user: IAuthUser) {
    return this.prisma.conversation.findMany({
      where: { workspace_id: user.workspace_id },
      include: { contact: true },
      orderBy: { updated_at: 'desc' },
    });
  }

  /**
   * GET /conversations/:id
   * Get a single conversation with messages.
   */
  @Get(':id')
  findOne(@AuthUser() user: IAuthUser, @Param('id') id: string) {
    return this.prisma.conversation.findFirst({
      where: { id, workspace_id: user.workspace_id },
      include: { contact: true, messages: { orderBy: { created_at: 'asc' } } },
    });
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  /**
   * POST /conversations/:id/messages
   *
   * Send an outbound message in a conversation.
   *
   * If the conversation belongs to an EMAIL channel AND the contact has an
   * email address, the message is delivered via Resend automatically.
   *
   * Body: { body_text?, body_html?, subject? }
   */
  @Post(':id/messages')
  async sendMessage(
    @AuthUser() user: IAuthUser,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    // ── 1. Load conversation with contact ───────────────────────────────────
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspace_id: user.workspace_id,
      },
      include: { contact: true },
    });

    if (!conversation) {
      return { error: `Conversation ${conversationId} not found.` };
    }

    // ── 2. Persist message in DB via MessagesService ────────────────────────
    const message = await this.messagesService.send({
      workspace_id: user.workspace_id,
      conversation_id: conversationId,
      direction: 'OUTBOUND',
      body_text: dto.body_text,
      body_html: dto.body_html,
    });

    // ── 3. If EMAIL channel → deliver via Resend ────────────────────────────
    if (conversation.channel_id) {
      const channel = await this.prisma.channel.findFirst({
        where: {
          id: conversation.channel_id,
          workspace_id: user.workspace_id,
        },
      });

      if (channel?.type === 'EMAIL') {
        const contactEmail = (conversation.contact as any)?.email;

        if (contactEmail) {
          const subject =
            dto.subject ??
            (conversation as any).subject ??
            'Nuevo mensaje';

          const bodyHtml =
            dto.body_html ??
            dto.body_text ??
            message.body_html ??
            message.body_text ??
            '';

          const bodyText = dto.body_text ?? message.body_text ?? undefined;

          try {
            const result = await this.emailService.sendOutbound(
              channel,
              contactEmail,
              subject,
              bodyHtml,
              bodyText,
            );

            this.logger.log(
              `Email sent to ${contactEmail} — Resend id: ${result.id}`,
            );

            // Optionally update message with external provider id
            await this.prisma.message
              .update({
                where: { id: message.id },
                data: {
                  raw_payload_json: {
                    ...(typeof message.raw_payload_json === 'object'
                      ? (message.raw_payload_json as object)
                      : {}),
                    resend_id: result.id,
                  },
                },
              })
              .catch((err) => {
                this.logger.warn(
                  'Could not update message with Resend id',
                  err?.message,
                );
              });
          } catch (err: any) {
            this.logger.error(
              `Failed to send email via Resend: ${err?.message}`,
            );
            // Re-throw so the caller knows delivery failed.
            throw err;
          }
        } else {
          this.logger.warn(
            `Conversation ${conversationId} is EMAIL but contact has no email address.`,
          );
        }
      }
    }

    return message;
  }

  // ── Messages list ─────────────────────────────────────────────────────────

  /**
   * GET /conversations/:id/messages
   * List all messages in a conversation.
   */
  @Get(':id/messages')
  getMessages(@AuthUser() user: IAuthUser, @Param('id') conversationId: string) {
    return this.prisma.message.findMany({
      where: {
        conversation_id: conversationId,
        workspace_id: user.workspace_id,
      },
      orderBy: { created_at: 'asc' },
    });
  }
}
