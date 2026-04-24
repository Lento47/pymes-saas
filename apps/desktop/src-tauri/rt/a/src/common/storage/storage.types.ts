import { Readable } from 'stream';

export type StorageMode = 'local' | 'remote';

export interface StorageUploadResult {
  key: string;
  size: number;
}

export interface StorageReadResult {
  stream: Readable;
  contentLength?: number;
  contentType?: string;
}

export interface StorageProvider {
  readonly mode: StorageMode;
  upload(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult>;
  read(key: string): Promise<StorageReadResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}
