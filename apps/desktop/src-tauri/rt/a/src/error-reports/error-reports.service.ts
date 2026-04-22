import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateErrorReportDto } from './dto/create-error-report.dto';
import { FilterErrorReportsDto } from './dto/filter-error-reports.dto';

@Injectable()
export class ErrorReportsService {
  private readonly logger = new Logger(ErrorReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get errorReportsRepo(): any {
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

    try {
      return await this.errorReportsRepo.create({
        data: {
          workspace_id: workspaceId,
          user_id: dto.client_user_id ?? null,
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
    } catch (error: any) {
      this.logger.error(`No se pudo guardar el error reportado por cliente: ${error?.message}`, error?.stack);
      return null;
    }
  }

  async createServerReport(data: {
    workspace_id?: string | null;
    user_id?: string | null;
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
    } catch (error: any) {
      this.logger.error(`No se pudo guardar el error del servidor: ${error?.message}`, error?.stack);
      return null;
    }
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
