import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CaseCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCaseId(caseId: string) {
    const diagnosticCase = await this.prisma.supportDiagnosticCase.findUnique({
      where: { id: caseId },
      select: { id: true },
    });
    if (!diagnosticCase) throw new NotFoundException('Diagnostic case not found');

    return this.prisma.supportCaseComment.findMany({
      where: { case_id: caseId },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        body: true,
        created_at: true,
        user: {
          select: { id: true, name: true, email: true, avatar_url: true },
        },
      },
    });
  }

  async create(
    caseId: string,
    workspaceId: string,
    userId: string,
    body: string,
  ) {
    const diagnosticCase = await this.prisma.supportDiagnosticCase.findUnique({
      where: { id: caseId },
      select: { id: true, workspace_id: true },
    });
    if (!diagnosticCase) throw new NotFoundException('Diagnostic case not found');
    if (diagnosticCase.workspace_id !== workspaceId) {
      throw new NotFoundException('Diagnostic case not found');
    }

    return this.prisma.supportCaseComment.create({
      data: {
        case_id: caseId,
        workspace_id: workspaceId,
        user_id: userId,
        body,
      },
      select: {
        id: true,
        body: true,
        created_at: true,
        user: {
          select: { id: true, name: true, email: true, avatar_url: true },
        },
      },
    });
  }
}
