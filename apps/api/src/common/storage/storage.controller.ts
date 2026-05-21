import { Controller, Get, Inject, Logger, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "./storage.service";
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
  ".css": "text/css",
  ".js": "application/javascript",
  ".xml": "application/xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
};

@Controller("storage/file")
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
  async serveFile(@Param("key") key: string, @Res() res: Response) {
    const driver = process.env.STORAGE_DRIVER ?? "local";
    if (driver === "s3" || driver === "minio") {
      try {
        const url = await this.storage.getPresignedUrl(key);
        return res.redirect(url);
      } catch (err) {
        this.logger.error(`Error generating presigned URL for ${key}:`, err);
        return res.status(500).json({ statusCode: 500, message: "Error al servir el archivo" });
      }
    }
    const resolved = path.resolve(this.basePath, key);
    if (
      !resolved.startsWith(path.resolve(this.basePath) + path.sep) &&
      resolved !== path.resolve(this.basePath)
    ) {
      return res.status(403).json({ statusCode: 403, message: "Acceso denegado" });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ statusCode: 404, message: "Archivo no encontrado" });
    }

    const ext = path.extname(key).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
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
