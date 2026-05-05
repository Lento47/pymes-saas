import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiService } from './ai.service';

@Injectable()
export class EngineeringFixService {
  private readonly logger = new Logger(EngineeringFixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async createFixCase(diagnosticCaseId: string) {
    const diagnostic = await this.prisma.supportDiagnosticCase.findUnique({
      where: { id: diagnosticCaseId },
      select: { id: true, module: true, error_code: true, title: true, user_description: true, safe_summary: true },
    });

    if (!diagnostic) {
      throw new NotFoundException(`Diagnostic case ${diagnosticCaseId} not found`);
    }

    const branchName = `fix/${diagnostic.module}-${diagnostic.error_code || diagnostic.id.slice(0, 8)}-${diagnostic.id.slice(0, 6)}`.toLowerCase().replace(/[^a-z0-9/-]/g, '-');

    const fixCase = await this.prisma.engineeringFixCase.create({
      data: {
        diagnostic_case_id: diagnosticCaseId,
        branch_name: branchName,
        status: 'PENDING',
      },
    });

    await this.prisma.supportDiagnosticCase.update({
      where: { id: diagnosticCaseId },
      data: { status: 'INVESTIGATING' },
    });

    this.logger.log(`Engineering fix case created: ${fixCase.id}, branch: ${branchName}`);

    // Auto-generate fix proposal via AI (fire-and-forget)
    this.proposeFixAndUpdate(fixCase.id, diagnostic, diagnosticCaseId).catch(err => {
      this.logger.error(`Auto fix proposal failed for ${fixCase.id}: ${err?.message}`);
    });

    return fixCase;
  }

  private async proposeFixAndUpdate(
    fixCaseId: string,
    diagnostic: { module: string; error_code: string | null; title: string; user_description: string | null; safe_summary: string | null },
    diagnosticCaseId: string,
  ) {
    const proposal = await this.aiService.generateFixProposal(diagnostic);
    if (!proposal) {
      await this.updateFixStatus(fixCaseId, { status: 'INVESTIGATING', error_log: 'AI fix proposal generation failed' });
      return;
    }

    await this.updateFixStatus(fixCaseId, {
      status: 'FIX_READY',
      fix_summary: proposal.fix_summary,
      files_changed: proposal.files_changed_json,
    });

    await this.prisma.supportDiagnosticCase.update({
      where: { id: diagnosticCaseId },
      data: { resolution_json: proposal },
    });

    this.logger.log(`Fix proposal generated for ${fixCaseId}`);
  }

  async approveFix(fixCaseId: string) {
    const fixCase = await this.prisma.engineeringFixCase.findUnique({ where: { id: fixCaseId } });
    if (!fixCase) throw new NotFoundException('Fix case not found');
    if (fixCase.status !== 'FIX_READY' && fixCase.status !== 'PENDING_APPROVAL') {
      throw new Error('Fix case must be in FIX_READY or PENDING_APPROVAL status to approve');
    }
    return this.updateFixStatus(fixCaseId, { status: 'PR_OPENED' });
  }

  async rejectFix(fixCaseId: string, reason: string) {
    const fixCase = await this.prisma.engineeringFixCase.findUnique({ where: { id: fixCaseId } });
    if (!fixCase) throw new NotFoundException('Fix case not found');
    return this.updateFixStatus(fixCaseId, {
      status: 'PENDING',
      error_log: reason || 'Rejected by admin',
    });
  }

  async listFixCases(workspaceId: string) {
    return (this.prisma as any).engineeringFixCase.findMany({
      where: {
        diagnosticCase: { workspace_id: workspaceId },
      },
      include: {
        diagnosticCase: { select: { title: true, module: true, error_code: true, category: true, risk_level: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async getFixCase(fixCaseId: string) {
    const fixCase = await (this.prisma as any).engineeringFixCase.findUnique({
      where: { id: fixCaseId },
      include: {
        diagnosticCase: { select: { id: true, title: true, module: true, error_code: true, category: true, risk_level: true, user_description: true, safe_summary: true, evidence_json: true } },
      },
    });
    if (!fixCase) throw new NotFoundException('Fix case not found');
    return fixCase;
  }

  async getDiagnosticCaseForFix(caseId: string) {
    return this.prisma.supportDiagnosticCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        workspace_id: true,
        module: true,
        error_code: true,
        trace_id: true,
        category: true,
        risk_level: true,
        title: true,
        user_description: true,
        safe_summary: true,
        steps_json: true,
        evidence_json: true,
        created_at: true,
      },
    });
  }

  async updateFixStatus(
    fixCaseId: string,
    data: {
      status?: string;
      pr_url?: string;
      pr_number?: number;
      files_changed?: any;
      test_added?: any;
      fix_summary?: string;
      rollback_notes?: string;
      error_log?: string;
    },
  ) {
    const updateData: any = { updated_at: new Date() };
    if (data.status) updateData.status = data.status;
    if (data.pr_url !== undefined) updateData.pr_url = data.pr_url;
    if (data.pr_number !== undefined) updateData.pr_number = data.pr_number;
    if (data.files_changed) updateData.files_changed_json = data.files_changed;
    if (data.test_added) updateData.test_added_json = data.test_added;
    if (data.fix_summary) updateData.fix_summary = data.fix_summary;
    if (data.rollback_notes) updateData.rollback_notes = data.rollback_notes;
    if (data.error_log !== undefined) updateData.error_log = data.error_log;

    return this.prisma.engineeringFixCase.update({
      where: { id: fixCaseId },
      data: updateData,
    });
  }
}
