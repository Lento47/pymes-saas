import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { parseJsonValue } from "../common/prisma/json";

const META_API_BASE = "https://graph.facebook.com/v19.0";

@Injectable()
export class MessageTemplatesService {
  private readonly logger = new Logger(MessageTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async list(workspaceId: string, channel?: string) {
    return this.prisma.messageTemplate.findMany({
      where: {
        workspace_id: workspaceId,
        ...(channel ? { channel } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async getById(workspaceId: string, id: string) {
    return this.prisma.messageTemplate.findFirst({
      where: { id, workspace_id: workspaceId },
    });
  }

  async create(workspaceId: string, userId: string, data: Record<string, any>) {
    return this.prisma.messageTemplate.create({
      data: {
        workspace: { connect: { id: workspaceId } },
        channel: data.channel ?? "WHATSAPP",
        name: data.name,
        external_template_id: data.external_template_id,
        category: data.category,
        language: data.language,
        body: data.body,
        status: data.status ?? "DRAFT",
        variables: data.variables ?? undefined,
        created_by: userId ? { connect: { id: userId } } : undefined,
      },
    });
  }

  async update(workspaceId: string, id: string, data: Record<string, any>) {
    return this.prisma.messageTemplate.updateMany({
      where: { id, workspace_id: workspaceId },
      data: {
        name: data.name,
        category: data.category,
        language: data.language,
        body: data.body,
        status: data.status,
        variables: data.variables ?? undefined,
      },
    });
  }

  async delete(workspaceId: string, id: string) {
    return this.prisma.messageTemplate.deleteMany({
      where: { id, workspace_id: workspaceId },
    });
  }

  async getApprovedForChannel(workspaceId: string, channel: string) {
    return this.prisma.messageTemplate.findMany({
      where: {
        workspace_id: workspaceId,
        channel,
        status: "APPROVED",
      },
      orderBy: { name: "asc" },
    });
  }

  async syncFromMeta(workspaceId: string): Promise<{ synced: number; created: number; updated: number }> {
    const channel = await this.prisma.channel.findFirst({
      where: { workspace_id: workspaceId, type: "WHATSAPP", status: "ACTIVE" },
    });
    if (!channel) throw new NotFoundException("No hay canal WhatsApp activo configurado.");

    const config = parseJsonValue<Record<string, any>>(channel.config_json, {});
    const wabaId: string = config.waba_id;
    const accessTokenEncrypted: string = config.access_token_encrypted;

    if (!wabaId || !accessTokenEncrypted) {
      throw new BadRequestException("El canal WhatsApp no tiene WABA ID o token de acceso configurados.");
    }

    let accessToken: string;
    try {
      accessToken = this.crypto.decrypt(accessTokenEncrypted);
    } catch {
      throw new BadRequestException("No se pudo descifrar el token de acceso del canal WhatsApp.");
    }

    const url = `${META_API_BASE}/${wabaId}/message_templates?fields=name,category,language,status,components&limit=100`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (err: any) {
      throw new BadRequestException(`Error de red al contactar Meta API: ${err?.message}`);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`Meta API respondió ${res.status}: ${body}`);
    }

    const json = (await res.json()) as { data: any[] };
    const templates: any[] = json.data ?? [];

    const STATUS_MAP: Record<string, string> = {
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      PENDING: "PENDING_APPROVAL",
      PAUSED: "DISABLED",
      DISABLED: "DISABLED",
    };

    let created = 0;
    let updated = 0;

    for (const tpl of templates) {
      const bodyComp = (tpl.components ?? []).find((c: any) => c.type === "BODY");
      const bodyText: string = bodyComp?.text ?? "";
      const metaStatus = String(tpl.status ?? "").toUpperCase();
      const dbStatus = STATUS_MAP[metaStatus] ?? "DRAFT";
      const language: string = tpl.language ?? "es";
      const category: string = tpl.category ?? "UTILITY";

      const existing = await this.prisma.messageTemplate.findFirst({
        where: { workspace_id: workspaceId, name: tpl.name, language, channel: "WHATSAPP" },
      });

      if (existing) {
        await this.prisma.messageTemplate.update({
          where: { id: existing.id },
          data: {
            status: dbStatus as any,
            body: bodyText || existing.body,
            category,
            external_template_id: tpl.id ?? existing.external_template_id,
          },
        });
        updated++;
      } else {
        await this.prisma.messageTemplate.create({
          data: {
            workspace: { connect: { id: workspaceId } },
            channel: "WHATSAPP",
            name: tpl.name,
            external_template_id: tpl.id,
            category,
            language,
            body: bodyText,
            status: dbStatus as any,
          },
        });
        created++;
      }
    }

    this.logger.log(`[templates] syncFromMeta workspace=${workspaceId} synced=${templates.length} created=${created} updated=${updated}`);
    return { synced: templates.length, created, updated };
  }
}
