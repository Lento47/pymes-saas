import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createWorker } from 'tesseract.js';
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

    this.logger.log(`Processing document job ${job.id} for document ${documentId}`);

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

    let ocrText = '';
    let ocrFailed = false;

    try {
      const fileBuffer = await this.storage.download(doc.storage_key);

      if (OCR_IMAGE_TYPES.some(t => doc.mime_type.startsWith(t))) {
        ocrText = await this.ocrImage(fileBuffer);
      } else if (doc.mime_type === 'application/pdf') {
        ocrText = await this.ocrPdf(fileBuffer);
      } else if (TEXT_TYPES.some(t => doc.mime_type.startsWith(t))) {
        ocrText = fileBuffer.toString('utf-8').slice(0, 5000);
      }
    } catch (err) {
      this.logger.warn(`File read/OCR failed for ${doc.file_name}: ${(err as Error).message}`);
      ocrFailed = true;
    }

    if (!ocrText && !ocrFailed) {
      ocrText = `Documento: ${doc.file_name} (${doc.mime_type}, ${(doc.file_size / 1024).toFixed(1)} KB)`;
    }

    // AI structuring — only pass real OCR text, not error strings
    let summaryText = '';
    let extractedData: any = {};

    const hasRealOcr = !ocrFailed && ocrText.length > 50 && !ocrText.startsWith('Documento:');

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
      summaryText = `Documento: ${doc.file_name}. ${status}. Procesado el ${new Date().toLocaleDateString('es-CR')}.`;
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ocr_text: ocrText,
        summary_text: summaryText,
        status: 'PROCESSED',
        extracted_data_json: stringifyJson(extractedData),
        updated_at: new Date(),
      },
    });

    this.logger.log(`Document ${documentId} processed — OCR: ${ocrText.length} chars, AI-structured: ${hasRealOcr}`);
    return { documentId, status: 'PROCESSED' };
  }

  private async ocrImage(buffer: Buffer): Promise<string> {
    const worker = await this.getTesseractWorker();
    const { data } = await worker.recognize(buffer);
    return data.text?.trim() || '';
  }

  private async ocrPdf(buffer: Buffer): Promise<string> {
    // PDF processing: Tesseract cannot read raw PDF. Attempt to extract
    // embedded text via basic content stream parsing for text-based PDFs.
    // For scanned/image-based PDFs, use pdf-to-image conversion.
    const header = buffer.slice(0, 5).toString('utf-8');
    if (!header.startsWith('%PDF')) {
      this.logger.warn('Not a valid PDF file');
      return '';
    }

    const text = buffer.toString('utf-8');
    // Try extracting text from PDF content streams (works for simple text PDFs)
    const btBlocks: string[] = [];
    const btRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    while ((match = btRegex.exec(text)) !== null) {
      const content = match[1];
      const tjMatches = content.match(/\(([^)]*)\)\s*Tj/g);
      if (tjMatches) {
        btBlocks.push(tjMatches.map(m => m.replace(/[()]|Tj/g, '').trim()).join(' '));
      }
    }
    if (btBlocks.length > 0) {
      return btBlocks.join('\n').slice(0, 5000);
    }

    // For image-based/scanned PDFs, return a clear signal
    this.logger.log(`PDF has no embedded text — likely a scanned document. OCR not available for PDF images yet.`);
    return '';
  }
}
