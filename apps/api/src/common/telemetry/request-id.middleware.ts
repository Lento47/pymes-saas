import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/** Attach a request ID to every incoming request. Propagated in response headers. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const id = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
    (req as any).requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
