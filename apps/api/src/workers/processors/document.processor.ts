import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as zlib from 'zlib';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { StorageService } from '../../common/storage/storage.service';
import { stringifyJson } from '../../common/prisma/json';
import { QUEUE_NAMES } from '../queues.constants';

interface DocumentJobData {
  documentId: string;
  workspaceId: string;
}

const OCR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
const TEXT_TYPES = ['text/plain', 'text/csv', 'application/json'];
const MAX_PDF_PAGES = 5;
const MAX_OCR_CHARS = 8000;

@Injectable()
@Processor(QUEUE_NAMES.DOCUMENT)
export class DocumentProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentProcessor.name);
  private tesseractWorker: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async onModuleDestroy() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.logger.log('Tesseract worker terminated');
    }
  }

  private async getTesseractWorker() {
    if (!this.tesseractWorker) {
      this.tesseractWorker = await createWorker('spa');
      this.logger.log('Tesseract worker initialized with Spanish language');
    }
    return this.tesseractWorker;
  }

  async process(job: Job<DocumentJobData>): Promise<any> {
    const { documentId, workspaceId } = job.data;
    const attempt = job.attemptsMade + 1;

    this.logger.log(`Processing document ${documentId} (attempt ${attempt}/${job.opts.attempts || 3})`);

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, workspace_id: workspaceId },
    });

    if (!doc) {
      this.logger.warn(`Document ${documentId} not found, skipping.`);
      return;
    }

    if (!doc.storage_key) {
      this.logger.warn(`Document ${documentId} has no storage_key, skipping.`);
      return;
    }

    if (doc.status === 'PROCESSED') {
      this.logger.log(`Document ${documentId} already processed, skipping.`);
      return;
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    try {
      const result = await this.doProcess(doc, documentId, workspaceId);
      return result;
    } catch (err) {
      this.logger.error(`Document processing failed permanently for ${documentId}: ${(err as Error).message}`);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          ocr_text: `Error: ${(err as Error).message}`.slice(0, 500),
          updated_at: new Date(),
        },
      });

      throw err; // re-throw so BullMQ marks job as failed
    }
  }

  private async doProcess(doc: any, documentId: string, workspaceId: string) {
    let ocrText = '';
    let ocrFailed = false;

    try {
      const fileBuffer = await this.storage.download(doc.storage_key);

      if (OCR_IMAGE_TYPES.some(t => doc.mime_type.startsWith(t))) {
        ocrText = await this.ocrImage(fileBuffer);
      } else if (doc.mime_type === 'application/pdf') {
        ocrText = await this.ocrPdf(fileBuffer);
      } else if (doc.mime_type.includes('wordprocessingml') || doc.mime_type === 'application/msword') {
        ocrText = await this.extractDocx(fileBuffer);
      } else if (doc.mime_type.includes('spreadsheetml') || doc.mime_type === 'application/vnd.ms-excel') {
        ocrText = await this.extractXlsx(fileBuffer);
      } else if (TEXT_TYPES.some(t => doc.mime_type.startsWith(t))) {
        ocrText = fileBuffer.toString('utf-8').slice(0, MAX_OCR_CHARS);
      }
    } catch (err) {
      this.logger.warn(`File read/OCR failed for ${doc.file_name}: ${(err as Error).message}`);
      ocrFailed = true;
    }

    if (!ocrText && !ocrFailed) {
      ocrText = `${doc.file_name} (${doc.mime_type}, ${(doc.file_size / 1024).toFixed(1)} KB)`;
    }

    let summaryText = '';
    let extractedData: any = {};

    const hasRealOcr = !ocrFailed && ocrText.length > 50 && !ocrText.startsWith(doc.file_name);

    if (hasRealOcr) {
      try {
        const aiResult = await this.aiService.analyzeDocument(doc.workspace_id, {
          fileName: doc.file_name,
          mimeType: doc.mime_type,
          fileSize: doc.file_size,
          ocrText,
        });
        if (aiResult) {
          summaryText = aiResult.summary || '';
          extractedData = aiResult.extractedData || {};
        }
      } catch (err) {
        this.logger.warn(`AI analysis failed for ${doc.file_name}: ${(err as Error).message}`);
      }
    }

    if (!summaryText) {
      const status = hasRealOcr ? 'OCR exitoso' : ocrFailed ? 'OCR fallido' : 'Sin OCR';
      summaryText = `${doc.file_name}. ${status}. Procesado ${new Date().toLocaleDateString('es-CR')}.`;
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ocr_text: ocrText.slice(0, 10000),
        summary_text: summaryText,
        status: 'PROCESSED',
        extracted_data_json: stringifyJson(extractedData),
        updated_at: new Date(),
      },
    });

    this.logger.log(`Document ${documentId} processed — OCR: ${ocrText.length} chars, AI: ${hasRealOcr}`);
    return { documentId, status: 'PROCESSED' };
  }

  // ── Image OCR ────────────────────────────────────────────────────────────

  private async ocrImage(buffer: Buffer): Promise<string> {
    const worker = await this.getTesseractWorker();
    const { data } = await worker.recognize(buffer);
    return data.text?.trim() || '';
  }

  // ── PDF OCR (embedded text → image rendering) ────────────────────────────

  private async ocrPdf(buffer: Buffer): Promise<string> {
    const header = buffer.slice(0, 5).toString('utf-8');
    if (!header.startsWith('%PDF')) {
      this.logger.warn('Not a valid PDF file');
      return '';
    }

    // Pass 1: extract embedded text (including FlateDecode compressed streams)
    const embeddedText = this.extractPdfText(buffer);
    if (embeddedText.length > 100) {
      this.logger.log(`PDF embedded text: ${embeddedText.length} chars`);
      return embeddedText.slice(0, MAX_OCR_CHARS);
    }

    // Pass 2: render pages as images and OCR (scanned PDFs)
    try {
      this.logger.log('PDF has no embedded text — rendering pages as images');
      const pageTexts: string[] = [];
      const worker = await this.getTesseractWorker();

      for (let page = 0; page < MAX_PDF_PAGES; page++) {
        try {
          const pngBuffer = await sharp(buffer, { pages: 1, page, density: 200 })
            .png()
            .toBuffer();
          const { data } = await worker.recognize(pngBuffer);
          const text = data.text?.trim() || '';
          if (text.length < 10 && page === 0) break; // empty page, stop
          pageTexts.push(text);
          this.logger.log(`PDF page ${page + 1}: ${text.length} chars`);
        } catch {
          if (page === 0) throw new Error('Cannot render any PDF pages');
          break; // subsequent pages failed — use what we have
        }
      }

      return pageTexts.join('\n---\n').slice(0, MAX_OCR_CHARS);
    } catch (err) {
      this.logger.warn(`PDF image rendering failed: ${(err as Error).message}`);
      return '';
    }
  }

  // ── PDF text extraction with FlateDecode support ─────────────────────────

  private extractPdfText(buffer: Buffer): string {
    const raw = buffer.toString('latin1');
    const btBlocks: string[] = [];

    // Extract raw stream objects with their filters
    const objRegex = /(\d+)\s+\d+\s+obj[\s\S]*?endobj/g;
    let objMatch;

    while ((objMatch = objRegex.exec(raw)) !== null) {
      const objContent = objMatch[0];

      // Check for FlateDecode
      const hasFlate = /\/FlateDecode/i.test(objContent);
      const streamMatch = objContent.match(/stream\s*([\s\S]*?)endstream/);

      if (streamMatch) {
        let streamData = streamMatch[1].replace(/\s+$/, '');

        if (hasFlate) {
          try {
            const inflated = zlib.inflateRawSync(Buffer.from(streamData, 'latin1'));
            streamData = inflated.toString('utf-8');
          } catch {
            continue; // couldn't decompress, skip this object
          }
        }

        // Extract text operators from the (possibly decompressed) content
        const textOps = streamData.match(/BT\s*([\s\S]*?)\s*ET/g);
        if (textOps) {
          for (const bt of textOps) {
            const words = bt.match(/\(([^)]*)\)\s*Tj/g);
            if (words) {
              btBlocks.push(words.map(w => w.replace(/[()]|Tj/g, '').trim()).join(' '));
            }
            const tjArr = bt.match(/\[([^\]]*)\]\s*TJ/);
            if (tjArr) {
              const strings = tjArr[1].match(/\(([^)]*)\)/g);
              if (strings) {
                btBlocks.push(strings.map(s => s.replace(/[()]/g, '').trim()).join(''));
              }
            }
          }
        }
      }
    }

    return btBlocks.join('\n').trim();
  }

  // ── Office documents ─────────────────────────────────────────────────────

  private async extractDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value?.trim()?.slice(0, MAX_OCR_CHARS) || '';
    } catch (err) {
      this.logger.warn(`DOCX extraction failed: ${(err as Error).message}`);
      return '';
    }
  }

  private extractXlsx(buffer: Buffer): string {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets: string[] = [];
      for (const name of workbook.SheetNames.slice(0, 3)) {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) sheets.push(`[${name}]\n${csv}`);
      }
      return sheets.join('\n\n').slice(0, MAX_OCR_CHARS);
    } catch (err) {
      this.logger.warn(`XLSX extraction failed: ${(err as Error).message}`);
      return '';
    }
  }
}
