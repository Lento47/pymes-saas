import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "./storage.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AuthUser } from "../../auth/strategies/jwt.strategy";
import { RequirePermission, Permission } from "../permissions";
import * as fs from "fs";
import * as path from "path";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".html": "text/html",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

/**
 * Returns true when the request key belongs to the requesting workspace.
 * Keys are expected to contain the workspace_id as a path segment (e.g.
 * "documents/{workspaceId}/...", "attachments/{workspaceId}/...",
 * "invoices/{workspaceId}/...", "audio/{workspaceId}/...").
 * Platform admins bypass this check.
 */
function keyBelongsToWorkspace(key: string, workspaceId: string, isPlatformAdmin: boolean): boolean {
  if (isPlatformAdmin) return true;
  // Normalise slashes and check if workspaceId appears as a path segment
  const segments = key.replace(/\\/g, "/").split("/");
  return segments.includes(workspaceId);
}

@Controller("storage/file")
@UseGuards(JwtAuthGuard)
@RequirePermission(Permission.FILES_READ)
export class StorageController {
  private readonly logger = new Logger(StorageController.name);
  private readonly basePath: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(StorageService) private readonly storage: Record<string, any>,
  ) {
    this.basePath =
      this.config.get<string>("STORAGE_LOCAL_PATH") ?? path.join(process.cwd(), "uploads");
  }

  @Get("{*key}")
  async serveFile(
    @Param("key") key: string,
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
  ) {
    if (!key) throw new NotFoundException("Archivo no especificado.");

    // Workspace isolation: key must contain the user's workspace_id as a path segment
    if (!keyBelongsToWorkspace(key, user.workspace_id, !!user.is_platform_admin)) {
      this.logger.warn(
        `Storage access denied: user=${user.id} workspace=${user.workspace_id} ` +
        `key=${key} — key does not belong to this workspace`,
      );
      throw new ForbiddenException("Acceso denegado al archivo.");
    }

    const driver = process.env.STORAGE_DRIVER ?? "local";
    if (driver === "s3" || driver === "minio") {
      try {
        const url = await this.storage.getPresignedUrl(key, 900); // 15 min signed URL
        return res.redirect(url);
      } catch (err) {
        this.logger.error(`Error generating presigned URL for ${key}:`, err);
        return res.status(500).json({ statusCode: 500, message: "Error al servir el archivo" });
      }
    }

    // Local storage: path traversal protection
    const resolved = path.resolve(this.basePath, key);
    if (
      !resolved.startsWith(path.resolve(this.basePath) + path.sep) &&
      resolved !== path.resolve(this.basePath)
    ) {
      this.logger.warn(`Path traversal attempt blocked: key=${key}`);
      return res.status(403).json({ statusCode: 403, message: "Acceso denegado" });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ statusCode: 404, message: "Archivo no encontrado" });
    }

    const ext = path.extname(key).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    // Authenticated content — use private cache to prevent browser caching for other users
    res.setHeader("Cache-Control", "private, max-age=900");
    const stream = fs.createReadStream(resolved);
    stream.pipe(res);
    stream.on("error", (err) => {
      this.logger.error(`Error streaming file ${key}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ statusCode: 500, message: "Error al servir el archivo" });
      }
    });
  }
}
