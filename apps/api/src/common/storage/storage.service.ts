import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { LocalDiskStorageService } from './local-disk-storage.service';
import { RemoteObjectStorageService } from './remote-object-storage.service';
import { StorageMode, StorageProvider, StorageReadResult, StorageUploadResult } from './storage.types';

@Injectable()
export class StorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly localStorage: LocalDiskStorageService,
    private readonly remoteStorage: RemoteObjectStorageService,
  ) {}

  get mode(): StorageMode {
    return this.resolveProvider().mode;
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageUploadResult> {
    return this.resolveProvider().upload(key, buffer, mimeType);
  }

  async read(key: string): Promise<StorageReadResult> {
    return this.resolveProvider().read(key);
  }

  async delete(key: string): Promise<void> {
    return this.resolveProvider().delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.resolveProvider().exists(key);
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return this.resolveProvider().healthCheck();
  }

  buildKey(
    workspaceId: string,
    documentId: string,
    filename: string,
    createdAt = new Date(),
    category = 'documents',
  ): string {
    const extension = this.sanitizeExtension(path.extname(filename));
    const year = createdAt.getUTCFullYear();
    const month = `${createdAt.getUTCMonth() + 1}`.padStart(2, '0');
    return `${category}/${workspaceId}/${year}/${month}/${documentId}${extension}`;
  }

  getDownloadPath(documentId: string): string {
    return `/api/documents/${documentId}/download`;
  }

  private resolveProvider(): StorageProvider {
    return this.resolveMode() === 'local' ? this.localStorage : this.remoteStorage;
  }

  private resolveMode(): StorageMode {
    const explicitMode = this.config.get<string>('PYMESHUB_STORAGE_MODE')?.toLowerCase();
    if (explicitMode === 'local' || explicitMode === 'remote') {
      return explicitMode;
    }

    const edition = this.config.get<string>('PYMESHUB_EDITION')?.toLowerCase();
    return edition === 'enterprise' ? 'local' : 'remote';
  }

  private sanitizeExtension(extension: string): string {
    const clean = extension.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
    return clean.startsWith('.') ? clean : clean ? `.${clean}` : '';
  }
}
