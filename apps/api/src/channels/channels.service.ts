import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ChannelType, ChannelStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { AuditService } from "../audit/audit.service";
import { parseJsonValue } from "../common/prisma/json";
import { ConfigureEmailDto } from "./dto/configure-email.dto";
import { ConfigureWhatsAppDto } from "./dto/configure-whatsapp.dto";
import { ConfigureTelegramDto } from "./dto/configure-telegram.dto";
import { TelegramService } from "../telegram/telegram.service";

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
    private readonly audit: AuditService,
  ) {}

  async create(workspaceId: string, dto: CreateChannelDto, actorId?: string) {
    const channel = await this.prisma.channel.create({
      data: {
        workspace_id: workspaceId,
        type: dto.type as ChannelType,
        name: dto.name,
        provider: dto.provider ?? dto.type.toLowerCase(),
        status: "PENDING_SETUP",
        config_json: {},
      },
    });
    void this.audit.log(workspaceId, {
      user_id: actorId,
      action: "channel.created",
      entity_type: "channel",
      entity_id: channel.id,
      after: { type: dto.type, name: dto.name },
    });
    return channel;
  }

  async findAll(workspaceId: string, includeInactive = false) {
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (!includeInactive) where.status = { not: "INACTIVE" };
    const channels = await this.prisma.channel.findMany({
      where,
      orderBy: { created_at: "asc" },
    });
    return channels.map((ch) => this.sanitise(ch));
  }

  async findOne(workspaceId: string, id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!channel) throw new NotFoundException("Canal no encontrado.");
    return this.sanitise(channel);
  }

  async update(workspaceId: string, id: string, dto: UpdateChannelDto, actorId?: string) {
    await this.assertOwnership(workspaceId, id);
    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.status ? { status: dto.status as ChannelStatus } : {}),
      },
    });
    void this.audit.log(workspaceId, {
      user_id: actorId,
      action: "channel.updated",
      entity_type: "channel",
      entity_id: id,
      after: { ...(dto.name && { name: dto.name }), ...(dto.status && { status: dto.status }) },
    });
    return this.sanitise(updated);
  }

  async remove(workspaceId: string, id: string, actorId?: string) {
    await this.assertOwnership(workspaceId, id);
    const channel = await this.prisma.channel.findFirst({ where: { id } });

    if (channel?.type === "TELEGRAM") {
      await this.telegramService.removeWebhook(id).catch((err) => {
        this.logger.warn(
          `Failed to remove Telegram webhook during deletion: ${(err as Error).message}`,
        );
      });
    }

    await this.prisma.channel.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    void this.audit.log(workspaceId, {
      user_id: actorId,
      action: "channel.deactivated",
      entity_type: "channel",
      entity_id: id,
      before: { type: channel?.type, name: channel?.name, status: channel?.status },
    });
    this.logger.log(`Channel ${id} (${channel?.type}) deactivated from workspace ${workspaceId}`);
    return { message: "Canal desactivado." };
  }

  async connect(workspaceId: string, id: string, actorId?: string) {
    await this.assertOwnership(workspaceId, id);
    const result = await this.prisma.channel.update({ where: { id }, data: { status: "ACTIVE" } });
    void this.audit.log(workspaceId, { user_id: actorId, action: "channel.connected", entity_type: "channel", entity_id: id });
    return result;
  }

  async disconnect(workspaceId: string, id: string, actorId?: string) {
    await this.assertOwnership(workspaceId, id);
    const channel = await this.prisma.channel.findFirst({ where: { id } });

    if (channel?.type === "TELEGRAM") {
      this.telegramService.removeWebhook(id).catch((err) => {
        this.logger.warn(`Failed to remove Telegram webhook: ${(err as Error).message}`);
      });
    }

    const result = await this.prisma.channel.update({ where: { id }, data: { status: "INACTIVE" } });
    void this.audit.log(workspaceId, { user_id: actorId, action: "channel.disconnected", entity_type: "channel", entity_id: id });
    return result;
  }

  // ── Email (Resend) ─────────────────────────────────────────────────────────

  async configureEmail(workspaceId: string, id: string, dto: ConfigureEmailDto, actorId?: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!channel) throw new NotFoundException("Canal no encontrado.");
    if (channel.type !== "EMAIL") throw new BadRequestException("El canal no es de tipo EMAIL.");

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
        status: "ACTIVE",
        config_json: {
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
        },
      },
    });

    this.logger.log(`EMAIL canal ${id} configurado para workspace ${workspaceId}`);
    void this.audit.log(workspaceId, { user_id: actorId, action: "channel.configured", entity_type: "channel", entity_id: id, after: { type: "EMAIL", from_email: dto.from_email } });
    this.trackQuickStart(workspaceId, "email_connected");
    return this.sanitise(updated);
  }

  // ── WhatsApp (Meta) ────────────────────────────────────────────────────────

  async configureWhatsApp(workspaceId: string, id: string, dto: ConfigureWhatsAppDto, actorId?: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!channel) throw new NotFoundException("Canal no encontrado.");
    if (channel.type !== "WHATSAPP")
      throw new BadRequestException("El canal no es de tipo WHATSAPP.");

    this.logger.log(
      `[DIAG] configureWhatsApp: channel=${id}, tokenProvided=${!!dto.access_token}, tokenLen=${dto.access_token?.length || 0}, phoneId=${dto.phone_number_id}`,
    );

    // Keep existing encrypted token if no new one is provided
    const existingConfigWA = parseJsonValue<Record<string, any>>(channel.config_json, {});
    let access_token_encrypted: string | undefined;
    if (dto.access_token) {
      try {
        access_token_encrypted = this.crypto.encrypt(dto.access_token);
        this.logger.log(
          `[DIAG] configureWhatsApp: encrypt OK, encryptedLen=${access_token_encrypted.length}`,
        );
      } catch (err) {
        this.logger.error(`[DIAG] configureWhatsApp: encrypt FAILED — ${err?.message}`);
        throw new BadRequestException(
          "Error al guardar el token. Verificá que ENCRYPTION_KEY esté configurada en el servidor.",
        );
      }
    } else {
      access_token_encrypted = existingConfigWA.access_token_encrypted;
      this.logger.log(
        `[DIAG] configureWhatsApp: no new token, keeping existing (hasToken=${!!access_token_encrypted})`,
      );
    }

    let app_secret_encrypted: string | undefined;
    if (dto.app_secret) {
      try {
        app_secret_encrypted = this.crypto.encrypt(dto.app_secret);
      } catch (err) {
        this.logger.error(`[DIAG] configureWhatsApp: app_secret encrypt FAILED — ${err?.message}`);
        throw new BadRequestException("Error al guardar el App Secret.");
      }
    } else {
      app_secret_encrypted = existingConfigWA.app_secret_encrypted;
    }

    const newConfig = {
      access_token_encrypted,
      app_secret_encrypted,
      phone_number_id: dto.phone_number_id,
      waba_id: dto.waba_id,
    };

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        status: "ACTIVE",
        config_json: newConfig,
      },
    });

    this.logger.log(
      `[DIAG] configureWhatsApp: DB updated, configKeys=${Object.keys(newConfig)
        .filter((k) => newConfig[k as keyof typeof newConfig] != null)
        .join(",")}`,
    );
    void this.audit.log(workspaceId, { user_id: actorId, action: "channel.configured", entity_type: "channel", entity_id: id, after: { type: "WHATSAPP", phone_number_id: dto.phone_number_id } });
    this.trackQuickStart(workspaceId, "whatsapp_connected");
    return this.sanitise(updated);
  }

  async configureTelegram(workspaceId: string, id: string, dto: ConfigureTelegramDto, actorId?: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!channel) throw new NotFoundException("Canal no encontrado.");
    if (channel.type !== "TELEGRAM")
      throw new BadRequestException("El canal no es de tipo TELEGRAM.");

    const existingConfig = parseJsonValue<Record<string, any>>(channel.config_json, {});

    // If a new token was passed, validate it BEFORE saving
    if (dto.bot_token) {
      const isValid = await this.telegramService.validateToken(dto.bot_token);
      if (!isValid)
        throw new BadRequestException(
          "Token de bot inválido o expirado. Verificá el token en @BotFather.",
        );
    }

    const bot_token_encrypted = dto.bot_token
      ? this.crypto.encrypt(dto.bot_token)
      : existingConfig.bot_token_encrypted;

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        status: "ACTIVE",
        config_json: { ...existingConfig, bot_token_encrypted },
      },
    });

    // Register webhook synchronously so we surface errors immediately
    try {
      await this.telegramService.registerWebhook(workspaceId, id);
      this.logger.log(
        `TELEGRAM canal ${id} configurado y webhook registrado para workspace ${workspaceId}`,
      );
    } catch (err) {
      // Webhook registration failed — keep the token saved but revert status
      await this.prisma.channel.update({
        where: { id },
        data: { status: "ERROR" },
      });
      this.logger.error(
        `Failed to register Telegram webhook for channel ${id}: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        `Token válido pero no se pudo registrar el webhook: ${(err as Error).message}`,
      );
    }

    void this.audit.log(workspaceId, { user_id: actorId, action: "channel.configured", entity_type: "channel", entity_id: id, after: { type: "TELEGRAM" } });
    return this.sanitise(updated);
  }

  // ── Helper interno para otros módulos ─────────────────────────────────────

  async findActiveByType(workspaceId: string, type: string) {
    return this.prisma.channel.findFirst({
      where: { workspace_id: workspaceId, type: type as ChannelType, status: ChannelStatus.ACTIVE },
    });
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  // NOTE: config_json may be a string (legacy JSON.stringify) or a parsed object.
  // parseJsonValue handles both cases, so the Record<string,any> annotation on
  // the channel param is imprecise but safe.
  private sanitise(channel: Record<string, any>) {
    const { config_json, ...rest } = channel;
    const safeConfig: Record<string, unknown> = {};
    const parsedConfig = parseJsonValue<Record<string, unknown>>(config_json, {});
    if (parsedConfig && typeof parsedConfig === "object") {
      for (const [k, v] of Object.entries(parsedConfig)) {
        if (!k.includes("encrypted")) safeConfig[k] = v;
      }
    }
    return { ...rest, config: safeConfig };
  }

  private async assertOwnership(workspaceId: string, id: string) {
    const ch = await this.prisma.channel.findFirst({
      where: { id },
      select: { workspace_id: true },
    });
    if (!ch) throw new NotFoundException("Canal no encontrado.");
    if (ch.workspace_id !== workspaceId) throw new ForbiddenException("Sin acceso a este canal.");
  }

  private async trackQuickStart(workspaceId: string, step: string) {
    try {
      const ws = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings_json: true },
      });
      const s: Record<string, any> =
        ws?.settings_json && typeof ws.settings_json === "object" ? ws.settings_json : {};
      const progress = s.quick_start_progress || {};
      if (progress[step]) return;
      s.quick_start_progress = { ...progress, [step]: true };
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { settings_json: s },
      });
    } catch {
      /* fire-and-forget */
    }
  }
}
