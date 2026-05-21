import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor(private readonly config: ConfigService) {
    this.basePath =
      this.config.get<string>("STORAGE_LOCAL_PATH") ?? path.join(process.cwd(), "uploads");
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
      this.logger.log(`Created local storage directory: ${this.basePath}`);
    }
  }

  async upload(
    key: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<{ key: string; size: number }> {
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    try {
      await fs.promises.writeFile(filePath, buffer);
      return { key, size: buffer.length };
    } catch (err) {
      this.logger.error(`Error writing file ${key}:`, err);
      throw new InternalServerErrorException("Error al guardar el archivo en storage local.");
    }
  }

  async getPresignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    return `/api/storage/file/${encodeURIComponent(key)}`;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    try {
      return await fs.promises.readFile(filePath);
    } catch (err) {
      if (err?.code === "ENOENT") {
        throw new InternalServerErrorException("Archivo no encontrado en storage local.");
      }
      this.logger.error(`Error reading file ${key}:`, err);
      throw new InternalServerErrorException("Error al leer el archivo del storage local.");
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      this.logger.error(`Error deleting file ${key}:`, err);
    }
  }

  buildKey(workspaceId: string, documentId: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    return `${workspaceId}/documents/${documentId}/${safe}`;
  }
}
