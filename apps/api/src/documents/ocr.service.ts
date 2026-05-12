import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

/**
 * OCR / text extraction service.
 *
 * Uses dynamic import for `pdf-parse` so that:
 *  - The API still builds and runs if the optional dep is not installed.
 *  - OCR is best-effort: failures degrade gracefully to metadata-only processing.
 *
 * Behavior is controlled by env vars:
 *   DOCUMENT_OCR_ENABLED      = '1' | 'true' to enable (default: disabled)
 *   DOCUMENT_OCR_MAX_BYTES    = max file size to OCR (default: 10 MB)
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    const v = this.config.get<string>('DOCUMENT_OCR_ENABLED');
    return v === '1' || v === 'true';
  }

  private maxBytes(): number {
    const raw = this.config.get<string | number>('DOCUMENT_OCR_MAX_BYTES');
    const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
    return Number.isFinite(n as number) && (n as number) > 0
      ? (n as number)
      : 10 * 1024 * 1024;
  }

  async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /** Extract text from a PDF buffer. Returns null if pdf-parse is unavailable. */
  async extractFromPdf(buffer: Buffer): Promise<string | null> {
    try {
      const mod: any = await import('pdf-parse').catch(() => null);
      if (!mod) {
        this.logger.warn('pdf-parse not installed; skipping PDF text extraction.');
        return null;
      }
      const pdfParse = mod.default ?? mod;
      const data = await pdfParse(buffer);
      return (data?.text ?? '').trim() || null;
    } catch (err) {
      this.logger.warn(`PDF extraction failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Extract text from PDF by mime type. Returns null if OCR disabled, file too large,
   * unsupported type, or the underlying lib is missing.
   */
  async extract(
    mimeType: string,
    fileSize: number,
    loadBuffer: () => Promise<Buffer>,
  ): Promise<string | null> {
    if (!this.isEnabled()) return null;

    const max = this.maxBytes();
    if (fileSize > max) {
      this.logger.warn(`File ${fileSize} bytes exceeds OCR max ${max}; skipping.`);
      return null;
    }

    const mime = mimeType.toLowerCase();
    if (mime === 'application/pdf') {
      const buf = await loadBuffer();
      return this.extractFromPdf(buf);
    }

    return null;
  }
}
