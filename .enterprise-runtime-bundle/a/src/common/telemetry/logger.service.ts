import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class AppLogger implements LoggerService {
  private writeLog(level: string, message: string, context?: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ?? 'App',
      service: process.env.OTEL_SERVICE_NAME ?? 'pymes-api',
    };
    console.log(JSON.stringify(entry));
  }

  log(message: string, context?: string) { this.writeLog('info', message, context); }
  error(message: string, trace?: string, context?: string) { this.writeLog('error', `${message} ${trace ?? ''}`.trim(), context); }
  warn(message: string, context?: string) { this.writeLog('warn', message, context); }
  debug(message: string, context?: string) { this.writeLog('debug', message, context); }
  verbose(message: string, context?: string) { this.writeLog('verbose', message, context); }
}