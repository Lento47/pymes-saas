import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface DiagnosticInput {
  workspaceId: string;
  userId?: string;
  module: string;
  error_code?: string;
  trace_id?: string;
  user_description?: string;
  error_report_id?: string;
}

export interface DiagnosticResult {
  case_id: string;
  category: string;
  risk_level: string;
  title: string;
  recommendation: string;
  matched_known_issue?: {
    error_code: string;
    title: string;
    workaround: string;
    fix_status: string;
  };
}

export const MODULE_MAP: Record<string, string> = {
  '/api/invoices': 'invoices',
  '/api/hacienda': 'hacienda',
  '/api/billing': 'billing',
  '/api/pipeline': 'pipeline',
  '/api/contacts': 'contacts',
  '/api/tasks': 'tasks',
  '/api/conversations': 'conversations',
  '/api/automations': 'automations',
  '/api/documents': 'documents',
  '/api/auth': 'auth',
  '/api/workspaces': 'workspaces',
  '/api/channels': 'channels',
  '/api/notifications': 'notifications',
  '/api/agent': 'agent',
  '/api/settings': 'settings',
};

@Injectable()
export class DiagnosticService {
  private readonly logger = new Logger(DiagnosticService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listCases(workspaceId: string) {
    return (this.prisma as any).supportDiagnosticCase.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async updateCaseStatus(id: string, status: string) {
    return (this.prisma as any).supportDiagnosticCase.update({
      where: { id },
      data: { status },
    });
  }

  async diagnose(input: DiagnosticInput): Promise<DiagnosticResult> {
    let evidence: any = {};

    // If an error_report_id was provided, fetch the actual error report for context
    if (input.error_report_id) {
      const errorReport = await (this.prisma as any).errorReport.findUnique({
        where: { id: input.error_report_id },
        select: { message: true, route: true, status_code: true, source: true, category: true, stack: true },
      });
      if (errorReport) {
        evidence.error_report = errorReport;
        input.module = input.module || MODULE_MAP[errorReport.route] || 'unknown';
        input.error_code = input.error_code || `${errorReport.source}_${errorReport.status_code}`;
        input.user_description = input.user_description || errorReport.message?.slice(0, 200);
      }
    }

    // Classify the issue
    const classification = this.classify(input, evidence);

    // Look up known issues by error_code
    let matchedIssue: any = null;
    if (input.error_code) {
      matchedIssue = await (this.prisma as any).supportKnownIssue.findUnique({
        where: { error_code: input.error_code },
      });
    }

    // Fallback: search by module + severity if no exact match
    if (!matchedIssue && input.module) {
      const candidates = await (this.prisma as any).supportKnownIssue.findMany({
        where: { module: input.module, is_active: true },
        orderBy: { severity: 'asc' },
        take: 3,
      });
      if (candidates.length > 0) {
        matchedIssue = candidates[0];
      }
    }

    // Don't persist USER_GUIDANCE cases — they're just noise, not real issues.
    // EXCEPT billing: always create a case for billing events (mission critical).
    if (classification.category === 'USER_GUIDANCE' && input.module !== 'billing') {
      this.logger.log(`Skipping USER_GUIDANCE case for ${input.module}: ${classification.title}`);
      return {
        case_id: 'skipped',
        category: classification.category,
        risk_level: classification.risk_level,
        title: classification.title,
        recommendation: classification.recommendation,
        matched_known_issue: matchedIssue ? {
          error_code: matchedIssue.error_code,
          title: matchedIssue.title,
          workaround: matchedIssue.workaround,
          fix_status: matchedIssue.fix_status,
        } : undefined,
      };
    }

    // Create the diagnostic case for real issues
    const caseRecord = await (this.prisma as any).supportDiagnosticCase.create({
      data: {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        module: input.module,
        error_code: input.error_code,
        trace_id: input.trace_id,
        category: classification.category,
        risk_level: classification.risk_level,
        status: matchedIssue ? 'INVESTIGATING' : 'OPEN',
        title: classification.title,
        user_description: input.user_description,
        safe_summary: classification.recommendation,
        evidence_json: evidence,
      },
    });

    this.logger.log(`Diagnostic case created: ${caseRecord.id} (${classification.category} / ${classification.risk_level})`);

    this.notifyAdmins(input.workspaceId, caseRecord.id, classification).catch((err) =>
      this.logger.error(`Failed to notify admins of diagnostic case: ${err?.message}`),
    );

    return {
      case_id: caseRecord.id,
      category: classification.category,
      risk_level: classification.risk_level,
      title: classification.title,
      recommendation: classification.recommendation,
      matched_known_issue: matchedIssue ? {
        error_code: matchedIssue.error_code,
        title: matchedIssue.title,
        workaround: matchedIssue.workaround,
        fix_status: matchedIssue.fix_status,
      } : undefined,
    };
  }

  private classify(input: DiagnosticInput, evidence: any): { category: string; risk_level: string; title: string; recommendation: string } {
    const msg = (input.user_description || '').toLowerCase() + ' ' + JSON.stringify(evidence).toLowerCase();

    if (msg.includes('circular') || msg.includes('undefined import') || msg.includes('cannot create')) {
      return this.result('PRODUCT_BUG', 'critical', 'Circular dependency detected in NestJS module graph', 'Add forwardRef() to the module at the reported index. Check the deployment logs for the full module chain.');
    }
    if (msg.includes('paddle') || msg.includes('webhook') || msg.includes('subscription')) {
      if (msg.includes('not configured') || msg.includes('missing')) {
        return this.result('WORKSPACE_CONFIGURATION', 'high', 'Billing integration not fully configured', 'Check PADDLE_WEBHOOK_SECRET and PADDLE_API_KEY are set on Railway. Verify webhook URL in Paddle dashboard.');
      }
      return this.result('BILLING_OR_PLAN', 'high', 'Paddle billing issue detected', 'Check the Paddle connection settings and subscription status. Use POST /api/billing/sync to re-sync.');
    }
    if (msg.includes('403') || msg.includes('forbidden') || msg.includes('plan') || msg.includes('limit') || msg.includes('quota')) {
      return this.result('PERMISSION_ISSUE', 'medium', 'Access denied or plan limit reached', 'Check the workspace plan (Ajustes → Facturación). Upgrade if limits are exceeded.');
    }
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('token') || msg.includes('session')) {
      return this.result('PERMISSION_ISSUE', 'medium', 'Authentication issue', 'Ask the user to log out and log in again. If persistent, check JWT_SECRET on Railway.');
    }
    if (msg.includes('hacienda') || msg.includes('cabys') || msg.includes('xml') || msg.includes('firma')) {
      return this.result('PRODUCT_BUG', 'high', 'Hacienda integration issue', 'The XML signing is currently a stub. For staging, unsigned XML may work. For production, XAdES-EPES signing must be integrated.');
    }
    if (msg.includes('resend') || msg.includes('email') || msg.includes('smtp') || msg.includes('webhook secret')) {
      return this.result('WORKSPACE_CONFIGURATION', 'high', 'Email channel configuration incomplete', 'Verify RESEND_API_KEY, RESEND_WEBHOOK_SECRET, and ENCRYPTION_KEY are set on Railway. For SMTP, check host/user/pass.');
    }
    if (msg.includes('500') || msg.includes('internal server error')) {
      return this.result('PLATFORM_INCIDENT', 'high', 'Server error detected', 'Check Railway logs for the full error stack. The ApiExceptionFilter reports these to the error_reports table.');
    }

    return this.result('USER_GUIDANCE', 'low', 'User guidance needed', 'This may be a configuration or usage question. The Support Agent can help with documentation and setup.');

    return { category: 'USER_GUIDANCE', risk_level: 'low', title: 'User guidance needed', recommendation: 'This may be a configuration or usage question.' };
  }

  private result(category: string, risk_level: string, title: string, recommendation: string) {
    return { category, risk_level, title, recommendation };
  }

  private async notifyAdmins(workspaceId: string, caseId: string, classification: { category: string; risk_level: string; title: string }) {
    const admins = await (this.prisma as any).workspaceUser.findMany({
      where: { workspace_id: workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { user_id: true },
    });

    for (const admin of admins) {
      try {
        await this.notifications.create(workspaceId, {
          user_id: admin.user_id,
          type: 'diagnostic_case',
          title: `Nuevo caso: ${classification.title}`,
          body: `Categoría: ${classification.category} | Riesgo: ${classification.risk_level}`,
          related_entity_type: 'support_diagnostic_case',
          related_entity_id: caseId,
        });
      } catch (err: any) {
        this.logger.error(`Notification to ${admin.user_id} failed: ${err?.message}`);
      }
    }
  }
}
