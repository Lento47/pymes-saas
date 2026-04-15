import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class TelemetryMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const start = Date.now();
    const { method, path } = req;

    res.on('finish', () => {
      const log = {
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 400 ? 'error' : 'info',
        method,
        path,
        statusCode: res.statusCode,
        duration_ms: Date.now() - start,
        workspace_id: req.headers['x-workspace-slug'] ?? null,
      };
      console.log(JSON.stringify(log));
    });

    next();
  }
}