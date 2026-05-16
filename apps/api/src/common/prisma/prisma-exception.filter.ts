import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Response } from 'express';

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor.';

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[])?.join(', ') ?? 'campo';
        message = `Ya existe un registro con ese ${target}.`;
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'El recurso solicitado no fue encontrado.';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Referencia inválida — el registro relacionado no existe.';
        break;
      default:
        this.logger.error(`Prisma error code ${exception.code}`, exception.message);
    }

    res.status(status).json({ statusCode: status, message, error: HttpStatus[status] });
  }
}
