import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface DocumentJobData {
  documentId: string;
  workspaceId: string;
}

@Injectable()
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(data: DocumentJobData): Promise<any> {
    const { documentId, workspaceId } = data;

    this.logger.log(`Processing document job for document ${documentId}`);

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, workspace_id: workspaceId },
    });

    if (!doc) {
      this.logger.warn(`Document ${documentId} not found in workspace ${workspaceId}, skipping.`);
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

    const ocr_text = `[OCR simulado para ${doc.file_name}] Texto extraído pendiente de integración con motor OCR.`;

    const isInvoice = /factura|invoice/i.test(doc.file_name);
    const isContract = /contrato|contract/i.test(doc.file_name);
    const docType = isInvoice ? 'invoice' : isContract ? 'contract' : 'general';

    const summary_text = `Documento tipo ${docType}: ${doc.file_name}. Procesado el ${new Date().toLocaleDateString('es-CR')}.`;

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ocr_text,
        summary_text,
        status: 'PROCESSED',
        extracted_data_json: {
          docType,
          processed_at: new Date().toISOString(),
        },
        updated_at: new Date(),
      },
    });

    this.logger.log(`Document completed: document=${documentId}, docType=${docType}`);

    return { documentId, docType, status: 'PROCESSED' };
  }
}
