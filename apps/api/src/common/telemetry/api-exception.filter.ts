import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorReportsService } from '../../error-reports/error-reports.service';

const SENSITIVE_QUERY_PARAMS = new Set(['token', 'password', 'api_key', 'secret', 'access_token', 'refresh_token', 'key', 'auth']);

function sanitizeQuery(query: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(query)) {
    result[k] = SENSITIVE_QUERY_PARAMS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return result;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly errorReports: ErrorReportsService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const internalMessage =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message ??
          (exception instanceof Error ? exception.message : 'Error interno del servidor');

    const errorName =
      typeof exceptionResponse === 'object' && exceptionResponse
        ? (exceptionResponse as any).error
        : undefined;

    // Return generic messages for 5xx in production to avoid leaking internals
    const isProduction = process.env.NODE_ENV === 'production';
    const clientMessage = isProduction && status >= 500
      ? 'Internal Server Error'
      : internalMessage;

    if (status >= 500) {
      await this.errorReports.createServerReport({
        workspace_id: request.user?.workspace_id ?? null,
        user_id: request.user?.id ?? null,
        source: 'BACKEND',
        category: 'HTTP_EXCEPTION',
        severity: 'ERROR',
        title: errorName ?? 'Unhandled server exception',
        message: Array.isArray(internalMessage) ? internalMessage.join(' | ') : String(internalMessage),
        stack: exception instanceof Error ? exception.stack : null,
        route: request.path,
        url: request.originalUrl,
        method: request.method,
        status_code: status,
        user_agent: request.headers['user-agent'] ?? null,
        context_json: {
          params: request.params,
          query: sanitizeQuery(request.query ?? {}),
          workspace_slug: request.headers['x-workspace-slug'] ?? null,
        },
      });
    }

    this.logger.error(
      `${request.method} ${request.originalUrl} -> ${status}: ${Array.isArray(internalMessage) ? internalMessage.join(' | ') : internalMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      message: clientMessage,
      error: errorName ?? (status >= 500 ? 'Internal Server Error' : 'Request Error'),
    });
  }
}
