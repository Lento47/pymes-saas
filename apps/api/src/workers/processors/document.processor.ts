import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { stringifyJson } from '../../common/prisma/json';
import { QUEUE_NAMES } from '../queues.constants';

interface DocumentJobData {
  documentId: string;
  workspaceId: string;
}

@Injectable()
@Processor(QUEUE_NAMES.DOCUMENT)
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(private readonly prisma: PrismaService) {
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

    // 4. Simular OCR
    const ocr_text = `[OCR simulado para ${doc.file_name}] Texto extraído pendiente de integración con motor OCR.`;

    const isInvoice = /factura|invoice/i.test(doc.file_name);
    const isContract = /contrato|contract/i.test(doc.file_name);
    const docType = isInvoice ? 'invoice' : isContract ? 'contract' : 'general';

    const summary_text = `Documento tipo ${docType}: ${doc.file_name}. Procesado el ${new Date().toLocaleDateString('es-CR')}.`;

    // 5. Actualizar documento con resultados
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ocr_text,
        summary_text,
        status: 'PROCESSED',
        extracted_data_json: stringifyJson({
          docType,
          processed_at: new Date().toISOString(),
        }),
        updated_at: new Date(),
      },
    });

    this.logger.log(
      `Document job ${job.id} completed: document=${documentId}, docType=${docType}`,
    );

    return { documentId, docType, status: 'PROCESSED' };
  }
}
