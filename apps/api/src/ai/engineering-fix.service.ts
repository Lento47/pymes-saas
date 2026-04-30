import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class EngineeringFixService {
  private readonly logger = new Logger(EngineeringFixService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createFixCase(diagnosticCaseId: string) {
    const diagnostic = await this.prisma.supportDiagnosticCase.findUnique({
      where: { id: diagnosticCaseId },
      select: { id: true, module: true, error_code: true, title: true },
    });

    if (!diagnostic) {
      throw new Error(`Diagnostic case ${diagnosticCaseId} not found`);
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
    if (data.error_log) updateData.error_log = data.error_log;

    return this.prisma.engineeringFixCase.update({
      where: { id: fixCaseId },
      data: updateData,
    });
  }
}
