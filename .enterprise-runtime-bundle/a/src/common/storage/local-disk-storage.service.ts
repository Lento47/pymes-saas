import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants, createReadStream } from 'fs';
import { access, mkdir, rm, stat, writeFile } from 'fs/promises';
import * as path from 'path';
import {
  StorageProvider,
  StorageReadResult,
  StorageUploadResult,
} from './storage.types';

function defaultStorageRoot(): string {
  if (process.platform === 'win32') {
    return 'C:\\ProgramData\\Pymeshub\\data';
  }

  return path.resolve(process.cwd(), '.pymeshub', 'data');
}

@Injectable()
export class LocalDiskStorageService implements StorageProvider, OnModuleInit {
  readonly mode = 'local' as const;
  private readonly logger = new Logger(LocalDiskStorageService.name);
  private readonly storageRoot: string;

  constructor(private readonly config: ConfigService) {
    this.storageRoot =
      this.config.get<string>('PYMESHUB_STORAGE_ROOT') ?? defaultStorageRoot();
  }

  async onModuleInit() {
    await this.ensureRoot();
  }

  async upload(
    key: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<StorageUploadResult> {
    const target = this.resolveAbsolutePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return { key, size: buffer.length };
  }

  async read(key: string): Promise<StorageReadResult> {
    const target = this.resolveAbsolutePath(key);
    const info = await stat(target);

    return {
      stream: createReadStream(target),
      contentLength: info.size,
    };
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveAbsolutePath(key);

    try {
      await rm(target, { force: true });
    } catch (error) {
      this.logger.error(`Error eliminando archivo local ${target}`, error as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolveAbsolutePath(key), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.ensureRoot();
      await access(this.storageRoot, constants.R_OK | constants.W_OK);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : 'Storage local inaccesible.',
      };
    }
  }

  private async ensureRoot() {
    await mkdir(this.storageRoot, { recursive: true });
  }

  private resolveAbsolutePath(relativePath: string): string {
    const normalized = this.normalizeRelativePath(relativePath);
    const absoluteRoot = path.resolve(this.storageRoot);
    const target = path.resolve(absoluteRoot, ...normalized.split('/'));

    if (target !== absoluteRoot && !target.startsWith(`${absoluteRoot}${path.sep}`)) {
      throw new InternalServerErrorException('Ruta de storage fuera del root configurado.');
    }

    return target;
  }

  private normalizeRelativePath(relativePath: string): string {
    if (!relativePath) {
      throw new InternalServerErrorException('Ruta de storage vacia.');
    }

    if (path.isAbsolute(relativePath)) {
      throw new InternalServerErrorException('No se permiten rutas absolutas en storage.');
    }

    const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/'));
    if (normalized === '..' || normalized.startsWith('../')) {
      throw new InternalServerErrorException('Ruta de storage invalida.');
    }

    return normalized;
  }
}
