import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorReportsService } from '../../error-reports/error-reports.service';

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
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message ??
          (exception instanceof Error ? exception.message : 'Error interno del servidor');

    const errorName =
      typeof exceptionResponse === 'object' && exceptionResponse
        ? (exceptionResponse as any).error
        : undefined;

    if (status >= 500) {
      await this.errorReports.createServerReport({
        workspace_id: request.user?.workspace_id ?? null,
        user_id: request.user?.id ?? null,
        source: 'BACKEND',
        category: 'HTTP_EXCEPTION',
        severity: 'ERROR',
        title: errorName ?? 'Unhandled server exception',
        message: Array.isArray(message) ? message.join(' | ') : String(message),
        stack: exception instanceof Error ? exception.stack : null,
        route: request.path,
        url: request.originalUrl,
        method: request.method,
        status_code: status,
        user_agent: request.headers['user-agent'] ?? null,
        context_json: {
          params: request.params,
          query: request.query,
          workspace_slug: request.headers['x-workspace-slug'] ?? null,
        },
      });
    }

    this.logger.error(
      `${request.method} ${request.originalUrl} -> ${status}: ${Array.isArray(message) ? message.join(' | ') : message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      message,
      error: errorName ?? (status >= 500 ? 'Internal Server Error' : 'Request Error'),
    });
  }
}
