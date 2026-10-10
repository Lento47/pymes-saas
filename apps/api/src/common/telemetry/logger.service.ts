import { Injectable, LoggerService } from "@nestjs/common";

@Injectable()
export class AppLogger implements LoggerService {
  private static readonly MIN_LEVEL = process.env.LOG_LEVEL ?? "error";
  private static readonly LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

  private writeLog(level: string, message: string, context?: string) {
    if (AppLogger.LEVELS[level as keyof typeof AppLogger.LEVELS] < AppLogger.LEVELS[AppLogger.MIN_LEVEL]) {
      return;
    }
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ?? "App",
      service: process.env.OTEL_SERVICE_NAME ?? "pymes-api",
    };
    console.log(JSON.stringify(entry));
  }

  log(message: string, context?: string) {
    this.writeLog("info", message, context);
  }
  error(message: string, trace?: string, context?: string) {
    this.writeLog("error", `${message} ${trace ?? ""}`.trim(), context);
  }
  warn(message: string, context?: string) {
    this.writeLog("warn", message, context);
  }
  debug(message: string, context?: string) {
    this.writeLog("debug", message, context);
  }
  verbose(message: string, context?: string) {
    this.writeLog("verbose", message, context);
  }
}
