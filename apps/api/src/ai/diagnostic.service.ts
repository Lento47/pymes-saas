import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface DiagnosticContext {
  workspace_id: string;
  user_id?: string;
  module: string;
  error_code?: string;
  trace_id?: string;
  user_description?: string;
}

export interface DiagnosticResult {
  category: string;
  risk_level: string;
  title: string;
  context: Record<string, any>;
  known_issue?: { error_code: string; title: string; workaround?: string };
  recommendation: string;
  case_id: string;
}

@Injectable()
export class DiagnosticService {
  private readonly logger = new Logger(DiagnosticService.name);

  constructor(private readonly prisma: PrismaService) {}

  async diagnose(ctx: DiagnosticContext): Promise<DiagnosticResult> {
    const evidence: Record<string, any> = {};

    // 1. Collect workspace context
    const ws = await this.prisma.workspace.findUnique({
      where: { id: ctx.workspace_id },
      select: { id: true, name: true, slug: true, plan: true, status: true },
    });
    evidence.workspace = ws || { error: 'not_found' };

    // 2. Collect user context if available
    if (ctx.user_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: ctx.user_id },
        select: { id: true, name: true, email: true, status: true },
      });
      const role = await this.prisma.workspaceUser.findFirst({
        where: { workspace_id: ctx.workspace_id, user_id: ctx.user_id },
        select: { role: true },
      });
      evidence.user = user ? { ...user, role: role?.role } : null;
    }

    // 3. Module-specific status
    if (ctx.module === 'inbox') {
      const channels = await this.prisma.channel.findMany({
        where: { workspace_id: ctx.workspace_id },
        select: { id: true, type: true, name: true, status: true },
      });
      evidence.integrations = { channels };
    }

    if (ctx.module === 'billing') {
      const sub = await this.prisma.workspaceSubscription.findFirst({
        where: { workspace_id: ctx.workspace_id },
        select: { plan: true, status: true, provider: true },
      });
      evidence.billing = sub || { status: 'no_subscription' };
    }

    // 4. Check known issues
    let knownIssue = null;
    if (ctx.error_code) {
      knownIssue = await this.prisma.supportKnownIssue.findUnique({
        where: { error_code: ctx.error_code },
        select: { error_code: true, title: true, workaround: true, severity: true, fix_status: true },
      });
    }

    // 5. Classify
    const { category, risk_level } = this.classify(ctx, evidence, knownIssue);

    // 6. Create diagnostic case
    const case_ = await this.prisma.supportDiagnosticCase.create({
      data: {
        workspace_id: ctx.workspace_id,
        user_id: ctx.user_id || null,
        module: ctx.module,
        error_code: ctx.error_code || null,
        trace_id: ctx.trace_id || null,
        category,
        risk_level,
        status: 'OPEN',
        title: `Diagnosis: ${ctx.module}${ctx.error_code ? ` — ${ctx.error_code}` : ''}`,
        user_description: ctx.user_description || null,
        safe_summary: JSON.stringify(evidence),
        evidence_json: evidence as any,
      },
    });

    return {
      category,
      risk_level,
      title: case_.title,
      context: evidence,
      known_issue: knownIssue || undefined,
      recommendation: this.buildRecommendation(category, knownIssue),
      case_id: case_.id,
    };
  }

  private classify(
    ctx: DiagnosticContext,
    evidence: Record<string, any>,
    knownIssue: any,
  ): { category: string; risk_level: string } {
    if (knownIssue?.severity === 'critical') return { category: 'PLATFORM_INCIDENT', risk_level: 'critical' };
    if (knownIssue) {
      return { category: 'PRODUCT_BUG', risk_level: knownIssue.severity === 'high' ? 'high' : 'medium' };
    }

    if (ctx.module === 'billing' || ctx.module === 'subscription') {
      return { category: 'BILLING_OR_PLAN', risk_level: 'high' };
    }

    if (ctx.error_code?.startsWith('AUTH') || ctx.error_code?.startsWith('PERM')) {
      return { category: 'PERMISSION_ISSUE', risk_level: 'medium' };
    }

    if (ctx.module === 'settings' || ctx.module === 'workspace') {
      return { category: 'WORKSPACE_CONFIGURATION', risk_level: 'medium' };
    }

    return { category: 'USER_GUIDANCE', risk_level: 'low' };
  }

  private buildRecommendation(category: string, knownIssue: any): string {
    if (knownIssue?.workaround) return `Known issue — workaround: ${knownIssue.workaround}`;
    if (knownIssue) return 'Known issue detected. Engineering team notified. Use workaround if available.';

    switch (category) {
      case 'USER_GUIDANCE': return 'Check documentation or ask for step-by-step guidance.';
      case 'PERMISSION_ISSUE': return 'Contact your workspace admin to verify your role and permissions.';
      case 'WORKSPACE_CONFIGURATION': return 'Review workspace settings for this module.';
      case 'PRODUCT_BUG': return 'Bug investigation case created. Workaround may be available soon.';
      case 'BILLING_OR_PLAN': return 'Check your plan limits or contact support for billing help.';
      case 'PLATFORM_INCIDENT': return 'Critical issue — immediate escalation required.';
      default: return 'Support case created. Team will review.';
    }
  }
}
