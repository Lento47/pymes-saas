import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class TelemetryMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
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