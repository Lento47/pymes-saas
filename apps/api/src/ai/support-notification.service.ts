import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

/**
 * Closes the loop after a support case is resolved: tells the user
 * who reported the issue that it's been resolved, on whichever
 * channel(s) they're reachable on.
 *
 * Strategy:
 *   - In-app notification: always (free, doesn't depend on channel
 *     config, surfaces in the bell icon).
 *   - Email: when the workspace has an active EMAIL channel AND the
 *     reporter's user record has an email. The email body includes
 *     the resolution summary so the user has a paper trail outside
 *     the app.
 *   - WhatsApp: deferred — needs 24h-window logic + template
 *     selection + opt-in check, not in scope for Phase 2.
 *
 * Errors are swallowed and logged: missing email config or a Resend
 * outage shouldn't prevent the in-app notification from going out,
 * and shouldn't bubble up and roll back the case status update.
 */
@Injectable()
export class SupportNotificationService {
  private readonly logger = new Logger(SupportNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  async notifyResolution(diagnosticCaseId: string): Promise<void> {
    const dCase = await (this.prisma as any).supportDiagnosticCase.findUnique({
      where: { id: diagnosticCaseId },
      select: {
        id: true,
        workspace_id: true,
        user_id: true,
        title: true,
        module: true,
        resolution_json: true,
      },
    });
    if (!dCase) {
      this.logger.warn(`notifyResolution: diagnostic case ${diagnosticCaseId} not found`);
      return;
    }
    if (!dCase.user_id) {
      // Anonymous report (e.g. from /error-reports/client without
      // an authenticated user). Nothing to notify.
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dCase.user_id },
      select: { id: true, email: true, name: true },
    });
    if (!user) return;

    const resolution = (dCase.resolution_json as any) || {};
    const summary: string =
      resolution.resolution || resolution.summary || 'Tu reporte fue resuelto por el equipo de soporte.';

    // 1. In-app notification — always.
    await this.notifications
      .create(dCase.workspace_id, {
        user_id: user.id,
        type: 'support_case_resolved',
        title: `Tu reporte fue resuelto: ${dCase.title}`,
        body: summary.slice(0, 500),
        related_entity_type: 'support_diagnostic_case',
        related_entity_id: dCase.id,
      })
      .catch((err: any) => {
        this.logger.warn(`In-app notification failed for case ${dCase.id}: ${err?.message}`);
      });

    // 2. Email — best-effort. If the workspace has no EMAIL channel
    // or no `from_email` configured, skip silently.
    if (user.email) {
      this.sendResolutionEmail(dCase.workspace_id, user.email, user.name || user.email, dCase.title, summary).catch(
        (err: any) => {
          this.logger.warn(
            `Resolution email failed for case ${dCase.id} → ${user.email}: ${err?.message}`,
          );
        },
      );
    }
  }

  private async sendResolutionEmail(
    workspaceId: string,
    to: string,
    recipientName: string,
    caseTitle: string,
    resolutionSummary: string,
  ): Promise<void> {
    const channel = await this.prisma.channel.findFirst({
      where: { workspace_id: workspaceId, type: 'EMAIL', status: 'ACTIVE' },
    });
    if (!channel) {
      this.logger.log(`No active EMAIL channel for workspace ${workspaceId} — skipping email`);
      return;
    }

    const safeName = escapeHtml(recipientName);
    const safeTitle = escapeHtml(caseTitle);
    const safeSummary = escapeHtml(resolutionSummary).replace(/\n/g, '<br />');

    const subject = `[Resuelto] ${caseTitle}`;
    const html = `
      <p>Hola ${safeName},</p>
      <p>El reporte que abriste con el equipo de soporte fue resuelto:</p>
      <p><strong>${safeTitle}</strong></p>
      <p>${safeSummary}</p>
      <p>Si seguís encontrando el problema, respondé este correo o abrí un nuevo reporte desde la app.</p>
      <p style="color:#888;font-size:12px;">— Soporte PymesHub</p>
    `;
    const text =
      `Hola ${recipientName},\n\n` +
      `El reporte que abriste con el equipo de soporte fue resuelto:\n` +
      `${caseTitle}\n\n` +
      `${resolutionSummary}\n\n` +
      `Si seguís encontrando el problema, respondé este correo o abrí un nuevo reporte desde la app.\n\n` +
      `— Soporte PymesHub`;

    await this.email.sendOutbound(channel, to, subject, html, text);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
