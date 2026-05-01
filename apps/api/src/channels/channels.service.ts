import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { parseJsonValue, stringifyJson } from '../common/prisma/json';
import { ConfigureEmailDto } from './dto/configure-email.dto';
import { ConfigureWhatsAppDto } from './dto/configure-whatsapp.dto';
import { ConfigureTelegramDto } from './dto/configure-telegram.dto';
import { TelegramService } from '../telegram/telegram.service';

interface CreateChannelDto {
  type: string;
  name: string;
  provider?: string;
}

interface UpdateChannelDto {
  name?: string;
  status?: string;
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly telegramService: TelegramService,
  ) {}

  async create(workspaceId: string, dto: CreateChannelDto) {
    return this.prisma.channel.create({
      data: {
        workspace_id: workspaceId,
        type:         dto.type as any,
        name:         dto.name,
        provider:     dto.provider ?? dto.type.toLowerCase(),
        status:       'PENDING_SETUP',
        config_json:  stringifyJson({}),
      },
    });
  }

  async findAll(workspaceId: string) {
    const channels = await this.prisma.channel.findMany({
      where:   { workspace_id: workspaceId },
      orderBy: { created_at: 'asc' },
    });
    return channels.map(ch => this.sanitise(ch));
  }

  async findOne(workspaceId: string, id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!channel) throw new NotFoundException('Canal no encontrado.');
    return this.sanitise(channel);
  }

  async update(workspaceId: string, id: string, dto: UpdateChannelDto) {
    await this.assertOwnership(workspaceId, id);
    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        ...(dto.name   ? { name: dto.name }     : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
      },
    });
    return this.sanitise(updated);
  }

  async remove(workspaceId: string, id: string) {
    await this.assertOwnership(workspaceId, id);
    const channel = await this.prisma.channel.findFirst({ where: { id } });

    // Clean up webhooks/integrations before deletion
    if (channel?.type === 'TELEGRAM') {
      await this.telegramService.removeWebhook(id).catch((err) => {
        this.logger.warn(`Failed to remove Telegram webhook during deletion: ${(err as Error).message}`);
      });
    }

    await this.prisma.channel.delete({ where: { id } });
    this.logger.log(`Channel ${id} (${channel?.type}) deleted from workspace ${workspaceId}`);
    return { message: 'Canal eliminado.' };
  }

  async connect(workspaceId: string, id: string) {
    await this.assertOwnership(workspaceId, id);
    return this.prisma.channel.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async disconnect(workspaceId: string, id: string) {
    await this.assertOwnership(workspaceId, id);
    const channel = await this.prisma.channel.findFirst({ where: { id } });

    // Remove Telegram webhook if it's a Telegram channel
    if (channel?.type === 'TELEGRAM') {
      this.telegramService.removeWebhook(id).catch((err) => {
        this.logger.warn(`Failed to remove Telegram webhook: ${(err as Error).message}`);
      });
    }

    return this.prisma.channel.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  // ── Email (Resend) ─────────────────────────────────────────────────────────

  async configureEmail(workspaceId: string, id: string, dto: ConfigureEmailDto) {
    const channel = await this.prisma.channel.findFirst({ where: { id, workspace_id: workspaceId } });
    if (!channel) throw new NotFoundException('Canal no encontrado.');
    if (channel.type !== 'EMAIL') throw new BadRequestException('El canal no es de tipo EMAIL.');

    // Keep existing encrypted key if no new one is provided
    const existingConfig = parseJsonValue<Record<string, any>>(channel.config_json, {});
    const api_key_encrypted = dto.api_key
      ? this.crypto.encrypt(dto.api_key)
      : existingConfig.api_key_encrypted;

    const smtp_pass_encrypted = dto.smtp_password
      ? this.crypto.encrypt(dto.smtp_password)
      : existingConfig.smtp_pass_encrypted;

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        status:      'ACTIVE',
        config_json: stringifyJson({
          api_key_encrypted,
          from_email: dto.from_email.trim().toLowerCase(),
          from_name: dto.from_name.trim(),
          ...(dto.inbound_email?.trim()
            ? { inbound_email: dto.inbound_email.trim().toLowerCase() }
            : {}),
          ...(dto.smtp_host?.trim()
            ? {
                smtp_host: dto.smtp_host.trim(),
                smtp_port: dto.smtp_port ?? 587,
                smtp_user: dto.smtp_user?.trim(),
                smtp_pass_encrypted,
                smtp_tls: dto.smtp_tls ?? true,
              }
            : existingConfig.smtp_host
              ? {
                  smtp_host: existingConfig.smtp_host,
                  smtp_port: existingConfig.smtp_port ?? 587,
                  smtp_user: existingConfig.smtp_user,
                  smtp_pass_encrypted,
                  smtp_tls: existingConfig.smtp_tls ?? true,
                }
              : {}),
        }),
      },
    });

    this.logger.log(`EMAIL canal ${id} configurado para workspace ${workspaceId}`);
    return this.sanitise(updated);
  }

  // ── WhatsApp (Meta) ────────────────────────────────────────────────────────

  async configureWhatsApp(workspaceId: string, id: string, dto: ConfigureWhatsAppDto) {
    const channel = await this.prisma.channel.findFirst({ where: { id, workspace_id: workspaceId } });
    if (!channel) throw new NotFoundException('Canal no encontrado.');
    if (channel.type !== 'WHATSAPP') throw new BadRequestException('El canal no es de tipo WHATSAPP.');

    // Keep existing encrypted token if no new one is provided
    const existingConfigWA = parseJsonValue<Record<string, any>>(channel.config_json, {});
    const access_token_encrypted = dto.access_token
      ? this.crypto.encrypt(dto.access_token)
      : existingConfigWA.access_token_encrypted;

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        status:      'ACTIVE',
        config_json: stringifyJson({
          access_token_encrypted,
          phone_number_id: dto.phone_number_id,
          waba_id: dto.waba_id,
        }),
      },
    });

    this.logger.log(`WHATSAPP canal ${id} configurado para workspace ${workspaceId}`);
    return this.sanitise(updated);
  }

  async configureTelegram(workspaceId: string, id: string, dto: ConfigureTelegramDto) {
    const channel = await this.prisma.channel.findFirst({ where: { id, workspace_id: workspaceId } });
    if (!channel) throw new NotFoundException('Canal no encontrado.');
    if (channel.type !== 'TELEGRAM') throw new BadRequestException('El canal no es de tipo TELEGRAM.');

    const existingConfig = parseJsonValue<Record<string, any>>(channel.config_json, {});
    const bot_token_encrypted = dto.bot_token
      ? this.crypto.encrypt(dto.bot_token)
      : existingConfig.bot_token_encrypted;

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        config_json: stringifyJson({ ...existingConfig, bot_token_encrypted }),
      },
    });

    // Register webhook asynchronously (fire and forget)
    this.telegramService.registerWebhook(workspaceId, id).catch((err) => {
      this.logger.error(`Failed to register Telegram webhook for channel ${id}: ${(err as Error).message}`);
    });

    this.logger.log(`TELEGRAM canal ${id} configurado para workspace ${workspaceId}`);
    return this.sanitise(updated);
  }

  // ── Helper interno para otros módulos ─────────────────────────────────────

  async findActiveByType(workspaceId: string, type: string) {
    return this.prisma.channel.findFirst({
      where: { workspace_id: workspaceId, type: type as any, status: 'ACTIVE' },
    });
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private sanitise(channel: any) {
    const { config_json, ...rest } = channel;
    const safeConfig: Record<string, unknown> = {};
    const parsedConfig = parseJsonValue<Record<string, unknown>>(config_json, {});
    if (parsedConfig && typeof parsedConfig === 'object') {
      for (const [k, v] of Object.entries(parsedConfig)) {
        if (!k.includes('encrypted')) safeConfig[k] = v;
      }
    }
    return { ...rest, config: safeConfig };
  }

  private async assertOwnership(workspaceId: string, id: string) {
    const ch = await this.prisma.channel.findFirst({ where: { id }, select: { workspace_id: true } });
    if (!ch) throw new NotFoundException('Canal no encontrado.');
    if (ch.workspace_id !== workspaceId) throw new ForbiddenException('Sin acceso a este canal.');
  }
}
