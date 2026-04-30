import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

/**
 * OCR / text extraction service.
 *
 * Uses dynamic imports for `pdf-parse` and `tesseract.js` so that:
 *  - The API still builds and runs if these optional deps are not installed.
 *  - OCR is best-effort: failures degrade gracefully to metadata-only processing.
 *
 * To enable OCR install the deps in `apps/api`:
 *   pnpm add pdf-parse tesseract.js
 *
 * Behavior is controlled by env vars:
 *   DOCUMENT_OCR_ENABLED      = '1' | 'true' to enable (default: disabled)
 *   DOCUMENT_OCR_MAX_BYTES    = max file size to OCR (default: 10 MB)
 *   DOCUMENT_OCR_LANGS        = Tesseract languages, e.g. 'spa+eng' (default)
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

  private langs(): string {
    return this.config.get<string>('DOCUMENT_OCR_LANGS') || 'spa+eng';
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

  /** Extract text from an image buffer via Tesseract. Returns null if unavailable. */
  async extractFromImage(buffer: Buffer): Promise<string | null> {
    try {
      const mod: any = await import('tesseract.js').catch(() => null);
      if (!mod) {
        this.logger.warn('tesseract.js not installed; skipping image OCR.');
        return null;
      }
      const tesseract = mod.default ?? mod;
      const result = await tesseract.recognize(buffer, this.langs());
      return (result?.data?.text ?? '').trim() || null;
    } catch (err) {
      this.logger.warn(`Image OCR failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Extract text by mime type. Returns null if OCR disabled, file too large,
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

    if (mime.startsWith('image/')) {
      const buf = await loadBuffer();
      return this.extractFromImage(buf);
    }

    return null;
  }
}
