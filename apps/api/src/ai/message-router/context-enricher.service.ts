import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AgentType, ContextEnrichment } from "./types";

@Injectable()
export class ContextEnricherService {
  private readonly logger = new Logger(ContextEnricherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads workspace-scoped context relevant to the agent type.
   * Returned `summary` is injected into the AI prompt as a context block.
   * Never throws — on error returns empty enrichment.
   */
  async enrich(
    workspaceId: string,
    contactId: string | null,
    agentType: AgentType,
  ): Promise<ContextEnrichment> {
    try {
      const parts: string[] = [];
      const data: Record<string, unknown> = {};

      // ── Contact basics ────────────────────────────────────────────────────
      if (contactId) {
        const contact = await this.prisma.contact.findFirst({
          where: { id: contactId, workspace_id: workspaceId },
          select: { full_name: true, last_interaction_at: true },
        });
        if (contact) {
          parts.push(`Cliente: ${contact.full_name}`);
          if (contact.last_interaction_at) {
            parts.push(
              `Última interacción: ${contact.last_interaction_at.toLocaleDateString("es-CR")}`,
            );
          }
          data.contact_name = contact.full_name;
        }
      }

      // ── Billing context ───────────────────────────────────────────────────
      if (agentType === "billing" && contactId) {
        const invoices = await this.prisma.invoice.findMany({
          where: {
            workspace_id: workspaceId,
            contact_id: contactId,
            status: { notIn: ["CANCELLED", "DRAFT", "VOID"] },
          },
          select: { status: true, amount: true, due_date: true },
          orderBy: { due_date: "desc" },
          take: 5,
        });

        const pending = invoices.filter(
          (i) => i.status === "PENDING" || i.status === "OVERDUE",
        );
        const totalOwed = pending.reduce((s, i) => s + Number(i.amount), 0);

        if (pending.length > 0) {
          parts.push(
            `Facturas pendientes: ${pending.length} (total pendiente: ${totalOwed.toFixed(2)})`,
          );
        } else {
          parts.push("Sin facturas pendientes.");
        }
        data.pending_invoices = pending.length;
        data.total_owed = totalOwed;
      }

      // ── Sales context ─────────────────────────────────────────────────────
      if (agentType === "sales" && contactId) {
        const orders = await this.prisma.order.findMany({
          where: { workspace_id: workspaceId, contact_id: contactId },
          select: { status: true, title: true, created_at: true },
          orderBy: { created_at: "desc" },
          take: 3,
        });
        if (orders.length > 0) {
          parts.push(
            `Pedidos recientes: ${orders.map((o) => `${o.title} (${o.status})`).join(", ")}`,
          );
          data.recent_orders = orders.map((o) => ({ title: o.title, status: o.status }));
        }
      }

      // ── Support context ───────────────────────────────────────────────────
      if (agentType === "support") {
        const insights = await this.prisma.conversationInsight.findMany({
          where: {
            workspace_id: workspaceId,
            ...(contactId
              ? { conversation: { contact_id: contactId } }
              : {}),
          },
          select: { summary: true },
          orderBy: { created_at: "desc" },
          take: 3,
        });
        const summaries = insights
          .map((i) => i.summary)
          .filter(Boolean)
          .join(" | ");
        if (summaries) {
          parts.push(`Contexto de soporte previo: ${summaries.slice(0, 300)}`);
        }
      }

      return { summary: parts.join("\n"), data };
    } catch (err: unknown) {
      this.logger.warn(
        `[context-enricher] failed workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { summary: "", data: {} };
    }
  }
}
