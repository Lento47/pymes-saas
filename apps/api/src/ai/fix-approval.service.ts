/**
 * FixApprovalService
 *
 * Handles WhatsApp notifications when a fix case reaches FIX_READY,
 * and processes APROBAR / RECHAZAR commands from workspace admins.
 *
 * Notification flow:
 *   FIX_READY → find workspace OWNER phone (via Contact with matching email)
 *             → find workspace WA channel
 *             → send WA message with fix summary + APROBAR-{fixCaseId} instruction
 *
 * Approval flow (handled in MessagesService before AI routing):
 *   APROBAR-{fixCaseId}  → approveFix() → GitHub PR created
 *   RECHAZAR-{fixCaseId} → rejectFix()
 */
import { Injectable, Logger, Optional, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { EngineeringFixService } from "./engineering-fix.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";

@Injectable()
export class FixApprovalService {
  private readonly logger = new Logger(FixApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fixService: EngineeringFixService,
    @Optional() @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp?: WhatsAppService,
  ) {}

  /**
   * Notify workspace OWNER via WhatsApp that a fix case is ready to approve.
   * Called fire-and-forget from EngineeringFixService after FIX_READY.
   */
  async notifyFixReady(fixCaseId: string, workspaceId: string): Promise<void> {
    if (!this.whatsapp) return;

    try {
      const fixCase = await (this.prisma as any).engineeringFixCase.findUnique({
        where: { id: fixCaseId },
        include: {
          diagnosticCase: {
            select: { title: true, category: true, risk_level: true },
          },
        },
      });
      if (!fixCase) return;

      const summary = fixCase.fix_summary ?? "Fix propuesto por IA";
      const title   = fixCase.diagnosticCase?.title ?? "Error de plataforma";
      const risk    = fixCase.diagnosticCase?.risk_level ?? "HIGH";

      // Find workspace OWNER
      const ownerMembership = await this.prisma.workspaceUser.findFirst({
        where: { workspace_id: workspaceId, role: "OWNER" },
        select: { user_id: true },
      });
      if (!ownerMembership) return;

      const owner = await this.prisma.user.findUnique({
        where: { id: ownerMembership.user_id },
        select: { email: true },
      });
      if (!owner?.email) return;

      // Find contact with that email → get phone
      const contact = await this.prisma.contact.findFirst({
        where: { workspace_id: workspaceId, email: owner.email },
        select: { phone: true },
      });
      const phone = contact?.phone;
      if (!phone) {
        this.logger.warn(`[fix-approval] No phone found for workspace owner ${owner.email}`);
        return;
      }

      // Find active WA channel for this workspace
      const waChannel = await this.prisma.channel.findFirst({
        where: { workspace_id: workspaceId, type: "WHATSAPP", status: "ACTIVE" },
        select: { id: true, config_json: true, type: true },
      });
      if (!waChannel) {
        this.logger.warn(`[fix-approval] No active WA channel for workspace ${workspaceId}`);
        return;
      }

      const riskEmoji = risk === "CRITICAL" ? "🔴" : risk === "HIGH" ? "🟠" : "🟡";
      const message =
        `${riskEmoji} *Fix Propuesto — PymesHub*\n\n` +
        `*Error:* ${title}\n` +
        `*Riesgo:* ${risk}\n\n` +
        `*Fix:* ${summary.slice(0, 300)}${summary.length > 300 ? "..." : ""}\n\n` +
        `Para aprobar y crear el PR en GitHub:\n` +
        `*APROBAR-${fixCaseId}*\n\n` +
        `Para rechazar:\n` +
        `*RECHAZAR-${fixCaseId}*`;

      await this.whatsapp.sendMessage(
        waChannel as Record<string, any>,
        phone.replace(/\D/g, ""),
        message,
      );

      this.logger.log(`[fix-approval] WA notification sent to ${phone} for fix ${fixCaseId}`);
    } catch (err: any) {
      this.logger.warn(`[fix-approval] Failed to send WA notification: ${err?.message}`);
    }
  }

  /**
   * Try to parse and handle an APROBAR/RECHAZAR command from an inbound WA message.
   * Returns true if the message was a fix approval command (should not be routed to AI).
   */
  async handleApprovalCommand(params: {
    workspaceId: string;
    senderPhone: string;
    text: string;
    channelId: string;
    channelType: string;
  }): Promise<boolean> {
    const { workspaceId, senderPhone, text } = params;
    const normalized = text.trim().toUpperCase();

    const approveMatch = normalized.match(/^APROBAR-([A-Z0-9]+)/i);
    const rejectMatch  = normalized.match(/^RECHAZAR-([A-Z0-9]+)/i);
    if (!approveMatch && !rejectMatch) return false;

    const fixCaseId = (approveMatch ?? rejectMatch)![1];

    // Verify sender is OWNER or ADMIN of the workspace
    const contact = await this.prisma.contact.findFirst({
      where: { workspace_id: workspaceId, phone: { contains: senderPhone.replace(/\D/g, "").slice(-8) } },
      select: { email: true },
    });
    if (contact?.email) {
      const user = await this.prisma.user.findUnique({
        where: { email: contact.email },
        select: { id: true },
      });
      if (user) {
        const membership = await this.prisma.workspaceUser.findFirst({
          where: { workspace_id: workspaceId, user_id: user.id, role: { in: ["OWNER", "ADMIN"] } },
        });
        if (!membership) {
          this.logger.warn(`[fix-approval] Non-admin tried to approve fix: ${senderPhone}`);
          return false;
        }
      }
    }

    const actor = { workspaceId, isPlatformAdmin: false };

    if (approveMatch) {
      this.logger.log(`[fix-approval] Admin approved fix ${fixCaseId} via WA`);
      await this.fixService.approveFix(fixCaseId, actor).catch((err: any) => {
        this.logger.error(`[fix-approval] approveFix failed: ${err?.message}`);
      });
    } else {
      this.logger.log(`[fix-approval] Admin rejected fix ${fixCaseId} via WA`);
      await this.fixService.rejectFix(fixCaseId, "Rechazado vía WhatsApp", actor).catch((err: any) => {
        this.logger.error(`[fix-approval] rejectFix failed: ${err?.message}`);
      });
    }

    return true; // message handled, don't route to AI
  }
}
