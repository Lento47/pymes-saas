import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { ConfigureEmailDto } from './dto/configure-email.dto';
import { ConfigureWhatsAppDto } from './dto/configure-whatsapp.dto';

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
  ) {}

  async create(workspaceId: string, dto: CreateChannelDto) {
    return this.prisma.channel.create({
      data: {
        workspace_id: workspaceId,
        type:         dto.type as any,
        name:         dto.name,
        provider:     dto.provider ?? dto.type.toLowerCase(),
        status:       'PENDING_SETUP',
        config_json:  {},
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
    await this.prisma.channel.delete({ where: { id } });
    return { message: 'Canal eliminado.' };
  }

  async connect(workspaceId: string, id: string) {
    await this.assertOwnership(workspaceId, id);
    return this.prisma.channel.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async disconnect(workspaceId: string, id: string) {
    await this.assertOwnership(workspaceId, id);
    return this.prisma.channel.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  // ── Email (Resend) ─────────────────────────────────────────────────────────

  async configureEmail(workspaceId: string, id: string, dto: ConfigureEmailDto) {
    const channel = await this.prisma.channel.findFirst({ where: { id, workspace_id: workspaceId } });
    if (!channel) throw new NotFoundException('Canal no encontrado.');
    if (channel.type !== 'EMAIL') throw new BadRequestException('El canal no es de tipo EMAIL.');

    // Keep existing encrypted key if no new one is provided
    const existingConfig = (channel.config_json ?? {}) as Record<string, any>;
    const api_key_encrypted = dto.api_key
      ? this.crypto.encrypt(dto.api_key)
      : existingConfig.api_key_encrypted;

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        status:      'ACTIVE',
        config_json: { api_key_encrypted, from_email: dto.from_email, from_name: dto.from_name },
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
    const existingConfigWA = (channel.config_json ?? {}) as Record<string, any>;
    const access_token_encrypted = dto.access_token
      ? this.crypto.encrypt(dto.access_token)
      : existingConfigWA.access_token_encrypted;

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        status:      'ACTIVE',
        config_json: { access_token_encrypted, phone_number_id: dto.phone_number_id, waba_id: dto.waba_id },
      },
    });

    this.logger.log(`WHATSAPP canal ${id} configurado para workspace ${workspaceId}`);
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
    if (config_json && typeof config_json === 'object') {
      for (const [k, v] of Object.entries(config_json as object)) {
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
