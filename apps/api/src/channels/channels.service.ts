import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

// ─── Nota ────────────────────────────────────────────────────────────────────
// config_json puede contener API keys, secrets de webhook, etc.
// En producción: encriptar antes de persistir con AES-256 (p.ej. usando
// la librería `@nestjs/config` + variable ENCRYPTION_KEY) y desencriptar
// solo al momento de usar el canal.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /channels ──────────────────────────────────────────────────────────

  async findAll(workspaceId: string) {
    return this.prisma.channel.findMany({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        type: true,
        provider: true,
        name: true,
        status: true,
        created_at: true,
        updated_at: true,
        // config_json excluido — no exponer secrets en listado
      },
      orderBy: { created_at: 'asc' },
    });
  }

  // ── POST /channels ─────────────────────────────────────────────────────────

  async create(workspaceId: string, dto: CreateChannelDto) {
    return this.prisma.channel.create({
      data: {
        workspace_id: workspaceId,
        type:         dto.type,
        name:         dto.name,
        provider:     dto.provider,
        status:       'PENDING_SETUP',
        config_json:  dto.config ?? {},
      },
    });
  }

  // ── GET /channels/:id ──────────────────────────────────────────────────────

  async findOne(workspaceId: string, id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!channel) throw new NotFoundException('Canal no encontrado.');
    return channel;
  }

  // ── PATCH /channels/:id ────────────────────────────────────────────────────

  async update(workspaceId: string, id: string, dto: UpdateChannelDto) {
    await this.findOne(workspaceId, id);

    return this.prisma.channel.update({
      where: { id },
      data: {
        ...(dto.name     && { name: dto.name }),
        ...(dto.provider && { provider: dto.provider }),
        ...(dto.config   && { config_json: dto.config }),
      },
    });
  }

  // ── POST /channels/:id/connect ─────────────────────────────────────────────
  // Marca el canal como ACTIVE. La lógica real de OAuth / webhook registration
  // se implementa por proveedor (sendgrid, twilio, meta, etc.)

  async connect(workspaceId: string, id: string) {
    const channel = await this.findOne(workspaceId, id);

    if (channel.status === 'ACTIVE') {
      throw new BadRequestException('El canal ya está conectado.');
    }

    // TODO: por tipo de canal, validar que config_json tenga los campos requeridos
    // y realizar handshake con el proveedor.

    return this.prisma.channel.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  // ── POST /channels/:id/disconnect ──────────────────────────────────────────

  async disconnect(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);

    // TODO: revocar token / desregistrar webhook del proveedor

    return this.prisma.channel.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  // ── Helper interno — buscar canal activo por tipo ──────────────────────────

  async findActiveByType(workspaceId: string, type: string) {
    return this.prisma.channel.findFirst({
      where: { workspace_id: workspaceId, type: type as any, status: 'ACTIVE' },
    });
  }

  // ── DELETE /channels/:id ───────────────────────────────────────────────────

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.channel.delete({
      where: { id },
    });
  }
}
