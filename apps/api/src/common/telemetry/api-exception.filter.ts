import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorReportsService } from '../../error-reports/error-reports.service';
import { PrismaService } from '../prisma/prisma.service';

const SILENT_404_PATTERNS = [
  /\.php(\?.*)?$/i, /\/\.env\d*$/i, /\/\.env\..*$/i, /\/\.git\//i,
  /\/wp-admin/i, /\/wp-content/i, /\/wp-includes/i, /\/wp-json/i,
  /\/xmlrpc\.php/i, /\/robots\.txt$/i, /\/favicon\.ico$/i, /^\/$/,
  /\/vendor\//i, /\/actuator/i, /\/api\/v1\//i, /\/_ignition/i,
  /\/geoserver/i, /\/sso\/login/i, /\/solr\//i, /\/druid\//i,
  /\/console/i, /\/Api\/index/i, /\/webtools\//i,
];

const ERROR_KEYWORDS: { regex: RegExp; key: string; module: string }[] = [
  { regex: /whatsapp|meta.*api|access_token/i, key: 'WHATSAPP_CONFIG', module: 'channels' },
  { regex: /paddle|subscription|billing|plan.*chang/i, key: 'BILLING_FAILURE', module: 'billing' },
  { regex: /productId|column.*does not exist|P2022/i, key: 'SCHEMA_MISMATCH', module: 'database' },
  { regex: /foreign key|violates.*constraint|P2003/i, key: 'FK_CONSTRAINT', module: 'database' },
  { regex: /not found|no existe|not configured/i, key: 'MISSING_CONFIG', module: 'settings' },
  { regex: /balance|saldo|payment|pago/i, key: 'PAYMENT_ISSUE', module: 'invoices' },
  { regex: /stock|inventar/i, key: 'INVENTORY_ISSUE', module: 'inventory' },
  { regex: /bullmq|queue|job.*fail|redis.*connect|worker.*error/i, key: 'QUEUE_FAILURE', module: 'workers' },
  { regex: /socket|websocket|ws.*disconnect|connection.*refused/i, key: 'SOCKET_ERROR', module: 'gateways' },
  { regex: /timeout|timed out|ECONNREFUSED|ENOTFOUND|ECONNRESET/i, key: 'CONNECTIVITY_ISSUE', module: 'infra' },
  { regex: /memory|disk.*full|ENOSPC|heap.*limit/i, key: 'RESOURCE_ISSUE', module: 'infra' },
  { regex: /resolve.*credentials|invalid.*credentials|sign.*error/i, key: 'AUTH_ERROR', module: 'auth' },
];

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(
    private readonly errorReports: ErrorReportsService,
    private readonly prisma: PrismaService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message ??
          (exception instanceof Error ? exception.message : 'Error interno del servidor');

    const errorName =
      typeof exceptionResponse === 'object' && exceptionResponse
        ? (exceptionResponse as any).error
        : undefined;

    if (status === 404) {
      const url = request.originalUrl || request.url || '';
      if (SILENT_404_PATTERNS.some((p) => p.test(url))) {
        response.status(404).json({ statusCode: 404, message: 'Not Found' });
        return;
      }
    }

    const msg = typeof message === 'string' ? message : Array.isArray(message) ? message.join(' | ') : String(message);

    // 1) Open or reuse a diagnostic case so we can both link the ErrorReport
    //    and return the case_id in the HTTP response.
    let diagnosticCaseId: string | null = null;
    let errorCode: string | null = null;
    if (request.user?.workspace_id) {
      const matched = ERROR_KEYWORDS.find(k => k.regex.test(msg));
      if (matched || status >= 500 || status === 400) {
        errorCode = matched?.key ?? 'UNKNOWN_ERROR';
        const module = matched?.module ?? (request.path?.split('/')[2] || 'unknown');
        try {
          const existing = await (this.prisma as any).supportDiagnosticCase.findFirst({
            where: { workspace_id: request.user.workspace_id, error_code: errorCode, status: 'OPEN' },
            select: { id: true },
          });
          if (existing) {
            diagnosticCaseId = existing.id;
          } else {
            const created = await (this.prisma as any).supportDiagnosticCase.create({
              data: {
                workspace_id: request.user.workspace_id,
                user_id: request.user.id ?? null,
                module,
                error_code: errorCode,
                category: status >= 500 ? 'PLATFORM_INCIDENT' : 'WORKSPACE_CONFIGURATION',
                risk_level: status >= 500 ? 'high' : (status === 400 ? 'medium' : 'low'),
                status: 'OPEN',
                title: `${errorName || 'Error'} en ${module}: ${msg.slice(0, 80)}`,
                user_description: msg,
                safe_summary: `Ruta: ${request.method} ${request.path}. Status: ${status}. Revisar configuración o contactar soporte.`,
                evidence_json: { path: request.path, method: request.method, status, stack: exception instanceof Error ? exception.stack?.slice(0, 500) : null },
              },
              select: { id: true },
            });
            diagnosticCaseId = created.id;
            this.logger.log(`Auto-created diagnostic case ${diagnosticCaseId}: ${errorCode} for workspace ${request.user.workspace_id}`);
          }
        } catch (err: any) {
          this.logger.error(`Failed to create/lookup diagnostic case: ${err?.message}`);
        }
      }
    }

    // 2) Persist the ErrorReport (FK links it to the case if we opened one).
    if (status >= 500) {
      await this.errorReports.createServerReport({
        workspace_id: request.user?.workspace_id ?? null,
        user_id: request.user?.id ?? null,
        diagnostic_case_id: diagnosticCaseId,
        source: 'BACKEND',
        category: 'HTTP_EXCEPTION',
        severity: 'ERROR',
        title: errorName ?? 'Unhandled server exception',
        message: msg,
        stack: exception instanceof Error ? exception.stack : null,
        route: request.path,
        url: request.originalUrl,
        method: request.method,
        status_code: status,
        user_agent: request.headers['user-agent'] ?? null,
        context_json: { params: request.params, query: request.query, workspace_slug: request.headers['x-workspace-slug'] ?? null },
      });
    }

    this.logger.error(`${request.method} ${request.originalUrl} -> ${status}: ${msg}`, exception instanceof Error ? exception.stack : undefined);

    // 3) Surface the case to the client so the UI can link "Ver ticket".
    response.status(status).json({
      statusCode: status,
      message,
      error: errorName ?? (status >= 500 ? 'Internal Server Error' : 'Request Error'),
      ...(diagnosticCaseId ? { case_id: diagnosticCaseId, error_code: errorCode } : {}),
    });
  }
}
