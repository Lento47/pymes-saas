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

// ─── Type helpers ─────────────────────────────────────────────────────────────

interface CreateChannelDto {
  type: string;
  name: string;
  provider?: string;
}

interface UpdateChannelDto {
  name?: string;
  status?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(workspaceId: string, dto: CreateChannelDto) {
    return this.prisma.channel.create({
      data: {
        workspace_id: workspaceId,
        type: dto.type,
        name: dto.name,
        provider: dto.provider ?? dto.type.toLowerCase(),
        status: 'INACTIVE',
        config_json: {},
      },
    });
  }

  async findAll(workspaceId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { id: 'asc' },
    });

    // Strip sensitive keys before returning
    return channels.map((ch) => this.sanitise(ch));
  }

  async findOne(workspaceId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspace_id: workspaceId },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found.`);
    }

    return this.sanitise(channel);
  }

  async update(workspaceId: string, channelId: string, dto: UpdateChannelDto) {
    await this.assertOwnership(workspaceId, channelId);

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    return this.sanitise(updated);
  }

  async remove(workspaceId: string, channelId: string) {
    await this.assertOwnership(workspaceId, channelId);
    return this.prisma.channel.delete({ where: { id: channelId } });
  }

  // ── Email-specific ────────────────────────────────────────────────────────

  /**
   * Configure an EMAIL channel with Resend credentials.
   *
   * - Encrypts the api_key with AES-256-GCM before persisting.
   * - Sets channel status to ACTIVE.
   * - Returns the updated channel WITHOUT exposing the encrypted key.
   */
  async configureEmail(
    workspaceId: string,
    channelId: string,
    dto: ConfigureEmailDto,
  ) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspace_id: workspaceId },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found.`);
    }

    if (channel.type !== 'EMAIL') {
      throw new BadRequestException(
        `Channel ${channelId} is not of type EMAIL (got ${channel.type}).`,
      );
    }

    // Encrypt the API key — never store in plaintext
    const api_key_encrypted = this.crypto.encrypt(dto.api_key);

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        status: 'ACTIVE',
        config_json: {
          api_key_encrypted,
          from_email: dto.from_email,
          from_name: dto.from_name,
        },
      },
    });

    this.logger.log(
      `EMAIL channel ${channelId} configured for workspace ${workspaceId}`,
    );

    // Return without the encrypted key
    return this.sanitise(updated);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Remove sensitive fields from config_json before sending to the client.
   */
  private sanitise(channel: any) {
    const { config_json, ...rest } = channel;

    // Rebuild config without api_key_encrypted
    const safeConfig: Record<string, unknown> = {};
    if (config_json && typeof config_json === 'object') {
      for (const [k, v] of Object.entries(config_json)) {
        if (k !== 'api_key_encrypted') {
          safeConfig[k] = v;
        }
      }
    }

    return { ...rest, config: safeConfig };
  }

  private async assertOwnership(workspaceId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId },
      select: { workspace_id: true },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found.`);
    }

    if (channel.workspace_id !== workspaceId) {
      throw new ForbiddenException('Access denied to this channel.');
    }
  }
}
