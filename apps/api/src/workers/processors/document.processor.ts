import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { StorageService } from '../../common/storage/storage.service';
import { OcrService } from '../../documents/ocr.service';
import { stringifyJson } from '../../common/prisma/json';
import { QUEUE_NAMES } from '../queues.constants';

interface DocumentJobData {
  documentId: string;
  workspaceId: string;
}

type DocumentType =
  | 'invoice'
  | 'receipt'
  | 'contract'
  | 'payment_proof'
  | 'quote'
  | 'statement'
  | 'identification'
  | 'general';

const DOC_TYPE_PATTERNS: Array<{ type: DocumentType; regex: RegExp }> = [
  { type: 'invoice',        regex: /factura|invoice|bill(?:ing)?/i },
  { type: 'receipt',        regex: /recibo|receipt|ticket/i },
  { type: 'contract',       regex: /contrato|contract|agreement|acuerdo/i },
  { type: 'payment_proof',  regex: /comprobante.*pago|payment.*proof|transferencia/i },
  { type: 'quote',          regex: /cotizaci[oó]n|presupuesto|quote|quotation/i },
  { type: 'statement',      regex: /estado.*cuenta|statement|balance/i },
  { type: 'identification', regex: /c[eé]dula|pasaporte|identificaci[oó]n|id\b/i },
];

export function detectDocumentType(fileName: string): DocumentType {
  for (const { type, regex } of DOC_TYPE_PATTERNS) {
    if (regex.test(fileName)) return type;
  }
  return 'general';
}

@Injectable()
@Processor(QUEUE_NAMES.DOCUMENT)
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
  ) {
    super();
  }

  async process(job: Job<DocumentJobData>): Promise<any> {
    const { documentId, workspaceId } = job.data;

    this.logger.log(`Processing document job ${job.id} for document ${documentId}`);

    // 1. Cargar documento
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, workspace_id: workspaceId },
    });

    // 2. Si no existe o ya está procesado, return
    if (!doc) {
      this.logger.warn(`Document ${documentId} not found in workspace ${workspaceId}, skipping.`);
      return;
    }

    if (doc.status === 'PROCESSED') {
      this.logger.log(`Document ${documentId} already processed, skipping.`);
      return;
    }

    // 3. Actualizar status a PROCESSING
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    // 4. Detectar tipo y preparar fallbacks
    const docType = detectDocumentType(doc.file_name);
    const startedAt = new Date();

    let ocr_text = `Documento: ${doc.file_name} (${doc.mime_type}, ${(doc.file_size / 1024).toFixed(1)} KB)`;
    let summary_text = `Documento tipo ${docType}: ${doc.file_name}. Procesado el ${startedAt.toLocaleDateString('es-CR')}.`;
    let extractedData: Record<string, any> = {
      docType,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      fileSizeKb: Math.round(doc.file_size / 1024),
      processed_at: startedAt.toISOString(),
      ocr_extraction: false,
      ai_extraction: false,
    };

    // 5. OCR real (PDF/imagen) si está habilitado y dependencia disponible
    let ocrText: string | null = null;
    if (this.ocr.isEnabled() && doc.storage_key && doc.storage_key !== 'pending') {
      try {
        ocrText = await this.ocr.extract(
          doc.mime_type,
          doc.file_size,
          async () => {
            const { stream } = await this.storage.read(doc.storage_key);
            return this.ocr.streamToBuffer(stream);
          },
        );
        if (ocrText) {
          ocr_text = ocrText;
          extractedData.ocr_extraction = true;
          extractedData.ocr_chars = ocrText.length;
        }
      } catch (err) {
        this.logger.warn(`OCR extraction failed for ${doc.file_name}: ${(err as Error).message}`);
        extractedData.ocr_error = (err as Error).message;
      }
    }

    // 6. Intentar extracción/resumen IA (puede combinarse con OCR text)
    try {
      const aiResult = await this.aiService.analyzeDocument(doc.workspace_id, {
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
      });

      if (aiResult) {
        // Si OCR ya extrajo texto real, no lo sobrescribimos con texto inferido por IA
        if (!ocrText && aiResult.extractedText) {
          ocr_text = aiResult.extractedText;
        }
        summary_text = aiResult.summary || summary_text;
        extractedData = {
          ...extractedData,
          ...aiResult.extractedData,
          ai_extraction: true,
        };
      }
    } catch (err) {
      this.logger.warn(`AI extraction failed for ${doc.file_name}: ${(err as Error).message}`);
      extractedData.ai_error = (err as Error).message;
    }

    // 6. Persistir resultados
    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          ocr_text,
          summary_text,
          status: 'PROCESSED',
          extracted_data_json: stringifyJson(extractedData),
          updated_at: new Date(),
        },
      });

      const durationMs = Date.now() - startedAt.getTime();
      this.logger.log(
        `Document job ${job.id} completed: document=${documentId}, docType=${docType}, ocr=${extractedData.ocr_extraction}, ai=${extractedData.ai_extraction}, durationMs=${durationMs}`,
      );

      return { documentId, docType, status: 'PROCESSED', durationMs };
    } catch (err) {
      this.logger.error(
        `Failed to persist processed document ${documentId}: ${(err as Error).message}`,
      );
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', updated_at: new Date() },
      }).catch(() => undefined);
      throw err;
    }
  }
}
