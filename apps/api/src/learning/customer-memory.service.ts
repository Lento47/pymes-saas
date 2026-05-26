import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

interface CustomerMemoryPatch {
  profile_json?: Record<string, unknown>;
  objections_json?: string[];
  interests_json?: string[];
  lead_score?: number;
  risk_score?: number;
  next_best_action?: string;
  channel_preference?: string;
}

@Injectable()
export class CustomerMemoryService {
  private readonly logger = new Logger(CustomerMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(workspaceId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!contact) return null;

    const existing = await this.prisma.contactAiMemory.findUnique({
      where: { contact_id: contactId },
    });
    if (existing) return existing;

    return this.prisma.contactAiMemory.create({
      data: {
        contact_id: contactId,
        workspace_id: workspaceId,
        profile_json: {},
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async update(workspaceId: string, contactId: string, patch: CustomerMemoryPatch) {
    const mem = await this.getOrCreate(workspaceId, contactId);
    if (!mem) return null;

    return this.prisma.contactAiMemory.update({
      where: { contact_id: contactId },
      data: {
        ...(patch.profile_json !== undefined && { profile_json: patch.profile_json }),
        ...(patch.objections_json !== undefined && { objections_json: patch.objections_json }),
        ...(patch.interests_json !== undefined && { interests_json: patch.interests_json }),
        ...(patch.lead_score !== undefined && { lead_score: patch.lead_score }),
        ...(patch.risk_score !== undefined && { risk_score: patch.risk_score }),
        ...(patch.next_best_action !== undefined && { next_best_action: patch.next_best_action }),
        ...(patch.channel_preference !== undefined && { channel_preference: patch.channel_preference }),
      },
    });
  }

  async buildContextString(workspaceId: string, contactId: string): Promise<string> {
    try {
      const mem = await this.prisma.contactAiMemory.findFirst({
        where: { contact_id: contactId, workspace_id: workspaceId },
      });
      if (!mem) return "";

      const profile = (mem.profile_json ?? {}) as Record<string, unknown>;
      const lines: string[] = ["[MEMORIA DEL CLIENTE]"];

      if (profile["summary"]) lines.push(`Resumen: ${profile["summary"]}`);
      if (mem.next_best_action) lines.push(`Próxima acción: ${mem.next_best_action}`);
      if (mem.channel_preference) lines.push(`Canal preferido: ${mem.channel_preference}`);
      if (typeof mem.lead_score === "number" && mem.lead_score > 0)
        lines.push(`Score de lead: ${mem.lead_score}/100`);
      if (typeof mem.risk_score === "number" && mem.risk_score > 50)
        lines.push(`Riesgo de abandono: ${mem.risk_score}/100`);

      const objections = mem.objections_json as string[] | null;
      if (objections?.length) lines.push(`Objeciones frecuentes: ${objections.join(", ")}`);

      const interests = mem.interests_json as string[] | null;
      if (interests?.length) lines.push(`Intereses: ${interests.join(", ")}`);

      if (profile["communication_style"])
        lines.push(`Estilo de comunicación: ${profile["communication_style"]}`);

      return lines.length > 1 ? lines.join("\n") : "";
    } catch (err) {
      this.logger.warn(`Failed to build customer context: ${(err as Error).message}`);
      return "";
    }
  }
}
