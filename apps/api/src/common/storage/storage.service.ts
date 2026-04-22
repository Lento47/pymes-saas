import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Nota ────────────────────────────────────────────────────────────────────
// Esta abstracción funciona tanto con AWS S3 como con MinIO (misma API).
// Variables de entorno requeridas (.env):
//
//   STORAGE_ENDPOINT=http://localhost:9000    ← solo MinIO/custom; omitir para AWS
//   STORAGE_REGION=us-east-1
//   STORAGE_ACCESS_KEY=minio_user
//   STORAGE_SECRET_KEY=minio_password
//   STORAGE_BUCKET=pymes-documents
//   STORAGE_PUBLIC_URL=http://localhost:9000  ← base URL para links públicos
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT');

    this.client = new S3Client({
      region:      this.config.get<string>('STORAGE_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId:     this.config.get<string>('STORAGE_ACCESS_KEY')!,
        secretAccessKey: this.config.get<string>('STORAGE_SECRET_KEY')!,
      },
      // Solo para MinIO o S3-compatible:
      ...(endpoint && {
        endpoint,
        forcePathStyle: true, // requerido para MinIO
      }),
    });

    this.bucket = this.config.get<string>('STORAGE_BUCKET') ?? 'pymes-documents';
  }

  // ── Subir archivo ──────────────────────────────────────────────────────────

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ key: string; size: number }> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket:      this.bucket,
          Key:         key,
          Body:        buffer,
          ContentType: mimeType,
        }),
      );
      return { key, size: buffer.length };
    } catch (err) {
      this.logger.error(`Error subiendo archivo ${key}:`, err);
      throw new InternalServerErrorException('Error al subir el archivo al storage.');
    }
  }

  // ── URL firmada para descarga (expira en N segundos) ──────────────────────

  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  // ── Eliminar archivo ───────────────────────────────────────────────────────

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.error(`Error eliminando archivo ${key}:`, err);
    }
  }

  // ── Generar storage key normalizado ───────────────────────────────────────
  // Formato: {workspaceId}/documents/{documentId}/{filename}

  buildKey(workspaceId: string, documentId: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return `${workspaceId}/documents/${documentId}/${safe}`;
  }
}
