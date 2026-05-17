import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateErrorReportDto } from './dto/create-error-report.dto';
import { FilterErrorReportsDto } from './dto/filter-error-reports.dto';

@Injectable()
export class ErrorReportsService {
  private readonly logger = new Logger(ErrorReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get errorReportsRepo(): Record<string, any> {
    return (this.prisma as any).errorReport;
  }

  async createClientReport(dto: CreateErrorReportDto) {
    const workspaceId = dto.workspace_slug
      ? (
          await this.prisma.workspace.findUnique({
            where: { slug: dto.workspace_slug },
            select: { id: true },
          })
        )?.id ?? null
      : null;

    // Auto-ticket: ERROR/CRITICAL frontend errors with a known workspace get
    // a SupportDiagnosticCase opened (or reused) so the user/admin sees a ticket,
    // and the ErrorReport row is FK-linked to it.
    const severity = (dto.severity ?? 'ERROR').toUpperCase();
    const diagnosticCaseId = workspaceId && (severity === 'ERROR' || severity === 'CRITICAL')
      ? await this.openCaseForReport({
          workspace_id: workspaceId,
          user_id: dto.client_user_id ?? null,
          severity,
          source: dto.source,
          category: dto.category,
          title: dto.title ?? `${dto.category} en ${dto.source}`,
          message: dto.message,
          stack: dto.stack ?? null,
          route: dto.route ?? null,
          method: dto.method ?? null,
          status_code: dto.status_code ?? null,
        })
      : null;

    try {
      return await this.errorReportsRepo.create({
        data: {
          workspace_id: workspaceId,
          user_id: dto.client_user_id ?? null,
          diagnostic_case_id: diagnosticCaseId ?? undefined,
          source: dto.source,
          category: dto.category,
          severity: dto.severity ?? 'ERROR',
          title: dto.title,
          message: dto.message,
          stack: dto.stack,
          route: dto.route,
          url: dto.url,
          method: dto.method,
          status_code: dto.status_code,
          user_agent: dto.user_agent,
          occurred_at: dto.occurred_at ? new Date(dto.occurred_at) : new Date(),
          context_json: {
            ...(dto.context_json ?? {}),
            client_user_email: dto.client_user_email ?? null,
          },
        },
      });
    } catch (error: unknown) {
      this.logger.error(`No se pudo guardar el error reportado por cliente: ${error?.message}`, error?.stack);
      return null;
    }
  }

  async createServerReport(data: {
    workspace_id?: string | null;
    user_id?: string | null;
    diagnostic_case_id?: string | null;
    source: string;
    category: string;
    severity?: string;
    title?: string | null;
    message: string;
    stack?: string | null;
    route?: string | null;
    url?: string | null;
    method?: string | null;
    status_code?: number | null;
    user_agent?: string | null;
    context_json?: Record<string, unknown>;
    occurred_at?: Date;
  }) {
    try {
      return await this.errorReportsRepo.create({
        data: {
          workspace_id: data.workspace_id ?? null,
          user_id: data.user_id ?? null,
          diagnostic_case_id: data.diagnostic_case_id ?? undefined,
          source: data.source,
          category: data.category,
          severity: data.severity ?? 'ERROR',
          title: data.title ?? undefined,
          message: data.message,
          stack: data.stack ?? undefined,
          route: data.route ?? undefined,
          url: data.url ?? undefined,
          method: data.method ?? undefined,
          status_code: data.status_code ?? undefined,
          user_agent: data.user_agent ?? undefined,
          context_json: data.context_json,
          occurred_at: data.occurred_at ?? new Date(),
        },
      });
    } catch (error: unknown) {
      this.logger.error(`No se pudo guardar el error del servidor: ${error?.message}`, error?.stack);
      return null;
    }
  }

  // Reuse an OPEN case for the same workspace+module+source if one exists,
  // otherwise open a new one. Module is derived from the route so a flapping
  // endpoint doesn't generate a fresh ticket on every retry.
  private async openCaseForReport(input: {
    workspace_id: string;
    user_id: string | null;
    severity: string;
    source: string;
    category: string;
    title: string;
    message: string;
    stack: string | null;
    route: string | null;
    method: string | null;
    status_code: number | null;
  }): Promise<string | null> {
    const module = this.deriveModule(input.route);
    const cases = (this.prisma as any).supportDiagnosticCase;
    try {
      const existing = await cases.findFirst({
        where: {
          workspace_id: input.workspace_id,
          module,
          status: 'OPEN',
          // dedupe within a 24h window to keep cases fresh
          created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (existing) return existing.id;

      const created = await cases.create({
        data: {
          workspace_id: input.workspace_id,
          user_id: input.user_id ?? undefined,
          module,
          error_code: `${input.source}_${input.category}`.toUpperCase().slice(0, 60),
          category: input.severity === 'CRITICAL' ? 'PLATFORM_INCIDENT' : 'WORKSPACE_CONFIGURATION',
          risk_level: input.severity === 'CRITICAL' ? 'critical' : 'high',
          status: 'OPEN',
          title: input.title.slice(0, 120),
          user_description: input.message,
          safe_summary: `Origen: ${input.source}. Ruta: ${input.method ?? '-'} ${input.route ?? '-'}. Status: ${input.status_code ?? '-'}.`,
          evidence_json: {
            source: input.source,
            category: input.category,
            route: input.route,
            method: input.method,
            status_code: input.status_code,
            stack: input.stack?.slice(0, 500) ?? null,
          },
        },
        select: { id: true },
      });
      this.logger.log(`Auto-opened diagnostic case ${created.id} from ${input.source} report (${module})`);
      return created.id;
    } catch (error: unknown) {
      this.logger.error(`No se pudo abrir caso desde reporte de error: ${error?.message}`);
      return null;
    }
  }

  private deriveModule(path?: string | null): string {
    if (!path) return 'unknown';
    const parts = path.split('/').filter(Boolean);
    return parts.find((p) => p !== 'api' && p !== 'v1') ?? 'unknown';
  }

  async findAll(workspaceId: string, filters: FilterErrorReportsDto) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      workspace_id: workspaceId,
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
    };

    const [data, total] = await Promise.all([
      this.errorReportsRepo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurred_at: 'desc' },
      }),
      this.errorReportsRepo.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }
}
