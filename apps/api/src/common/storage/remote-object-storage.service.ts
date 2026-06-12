import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  StorageProvider,
  StorageReadResult,
  StorageUploadResult,
} from './storage.types';

@Injectable()
export class RemoteObjectStorageService implements StorageProvider {
  readonly mode = 'remote' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(RemoteObjectStorageService.name);

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT');

    this.client = new S3Client({
      region: this.config.get<string>('STORAGE_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('STORAGE_ACCESS_KEY') ?? '',
        secretAccessKey: this.config.get<string>('STORAGE_SECRET_KEY') ?? '',
      },
      ...(endpoint && {
        endpoint,
        forcePathStyle: true,
      }),
    });

    this.bucket = this.config.get<string>('STORAGE_BUCKET') ?? 'pymes-documents';
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageUploadResult> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ServerSideEncryption: "AES256",
        }),
      );
      return { key, size: buffer.length };
    } catch (error) {
      this.logger.error(`Error subiendo archivo remoto ${key}`, error as Error);
      throw new InternalServerErrorException('Error al subir el archivo al storage remoto.');
    }
  }

  async read(key: string): Promise<StorageReadResult> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      if (!response.Body) {
        throw new InternalServerErrorException('El storage remoto no devolvio contenido.');
      }

      return {
        stream: this.toReadable(response.Body),
        contentLength: response.ContentLength,
        contentType: response.ContentType,
      };
    } catch (error) {
      this.logger.error(`Error leyendo archivo remoto ${key}`, error as Error);
      throw new InternalServerErrorException('Error al leer el archivo del storage remoto.');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.error(`Error eliminando archivo remoto ${key}`, error as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.read(key);
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        detail:
          error instanceof Error ? error.message : 'Bucket remoto inaccesible.',
      };
    }
  }

  async getPresignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  private toReadable(body: unknown): Readable {
    if (body instanceof Readable) {
      return body;
    }

    if (
      typeof body === 'object' &&
      body !== null &&
      'transformToWebStream' in body &&
      typeof (body as { transformToWebStream: () => ReadableStream }).transformToWebStream === 'function'
    ) {
      return Readable.fromWeb(
        (body as { transformToWebStream: () => ReadableStream }).transformToWebStream(),
      );
    }

    return Readable.from(body as AsyncIterable<Uint8Array>);
  }
}
