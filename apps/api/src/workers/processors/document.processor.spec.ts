import { Test, TestingModule } from '@nestjs/testing';
import { DocumentProcessor, detectDocumentType } from './document.processor';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { StorageService } from '../../common/storage/storage.service';
import { OcrService } from '../../documents/ocr.service';

describe('detectDocumentType', () => {
  it('detects invoices', () => {
    expect(detectDocumentType('factura-001.pdf')).toBe('invoice');
    expect(detectDocumentType('Invoice_2024.pdf')).toBe('invoice');
    expect(detectDocumentType('billing-march.pdf')).toBe('invoice');
  });

  it('detects receipts', () => {
    expect(detectDocumentType('recibo-vega.pdf')).toBe('receipt');
    expect(detectDocumentType('ticket-123.jpg')).toBe('receipt');
  });

  it('detects contracts', () => {
    expect(detectDocumentType('contrato-cliente.pdf')).toBe('contract');
    expect(detectDocumentType('Service Agreement.docx')).toBe('contract');
  });

  it('detects payment proofs', () => {
    expect(detectDocumentType('comprobante de pago abril.pdf')).toBe('payment_proof');
    expect(detectDocumentType('transferencia-banco.pdf')).toBe('payment_proof');
  });

  it('detects quotes', () => {
    expect(detectDocumentType('cotización-mora.pdf')).toBe('quote');
    expect(detectDocumentType('presupuesto.pdf')).toBe('quote');
  });

  it('detects statements', () => {
    expect(detectDocumentType('estado de cuenta.pdf')).toBe('statement');
  });

  it('detects identification', () => {
    expect(detectDocumentType('cedula-juan.jpg')).toBe('identification');
    expect(detectDocumentType('pasaporte.pdf')).toBe('identification');
  });

  it('falls back to general', () => {
    expect(detectDocumentType('random.pdf')).toBe('general');
    expect(detectDocumentType('photo.jpg')).toBe('general');
  });
});

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;

  const mockPrisma = {
    document: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAi = {
    analyzeDocument: jest.fn(),
  };

  const mockStorage = {
    read: jest.fn(),
  };

  const mockOcr = {
    isEnabled: jest.fn().mockReturnValue(false),
    extract: jest.fn(),
    streamToBuffer: jest.fn(),
  };

  const baseDoc = {
    id: 'doc-1',
    workspace_id: 'ws-1',
    file_name: 'factura-abril.pdf',
    mime_type: 'application/pdf',
    file_size: 50_000,
    storage_key: 'documents/ws-1/2026/04/doc-1.pdf',
    status: 'UPLOADED',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAi },
        { provide: StorageService, useValue: mockStorage },
        { provide: OcrService, useValue: mockOcr },
      ],
    }).compile();

    processor = module.get<DocumentProcessor>(DocumentProcessor);
  });

  function makeJob(overrides: any = {}): any {
    return {
      id: 'job-1',
      data: { documentId: baseDoc.id, workspaceId: baseDoc.workspace_id, ...overrides },
    };
  }

  it('skips when document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);
    const result = await processor.process(makeJob());
    expect(result).toBeUndefined();
    expect(mockPrisma.document.update).not.toHaveBeenCalled();
  });

  it('skips when document is already PROCESSED', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({ ...baseDoc, status: 'PROCESSED' });
    const result = await processor.process(makeJob());
    expect(result).toBeUndefined();
    expect(mockPrisma.document.update).not.toHaveBeenCalled();
  });

  it('processes with metadata-only when no OCR and no AI', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
    mockAi.analyzeDocument.mockResolvedValue(null);

    const result = await processor.process(makeJob());

    expect(result).toMatchObject({ documentId: 'doc-1', docType: 'invoice', status: 'PROCESSED' });
    expect(mockPrisma.document.update).toHaveBeenCalledTimes(2); // PROCESSING then PROCESSED
    const persistCall = mockPrisma.document.update.mock.calls[1][0];
    expect(persistCall.data.status).toBe('PROCESSED');
    expect(persistCall.data.ocr_text).toContain('factura-abril.pdf');
    const stored = JSON.parse(persistCall.data.extracted_data_json);
    expect(stored.docType).toBe('invoice');
    expect(stored.ocr_extraction).toBe(false);
    expect(stored.ai_extraction).toBe(false);
  });

  it('uses OCR text when available and skips AI extracted text', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
    mockOcr.isEnabled.mockReturnValue(true);
    mockOcr.extract.mockResolvedValue('Real PDF text from OCR');
    mockAi.analyzeDocument.mockResolvedValue({
      extractedText: 'AI inferred text (should be ignored)',
      summary: 'AI summary',
      extractedData: { vendor: 'ACME' },
    });

    const result = await processor.process(makeJob());

    expect(result?.status).toBe('PROCESSED');
    const persistCall = mockPrisma.document.update.mock.calls[1][0];
    expect(persistCall.data.ocr_text).toBe('Real PDF text from OCR');
    expect(persistCall.data.summary_text).toBe('AI summary');
    const stored = JSON.parse(persistCall.data.extracted_data_json);
    expect(stored.ocr_extraction).toBe(true);
    expect(stored.ocr_chars).toBe('Real PDF text from OCR'.length);
    expect(stored.ai_extraction).toBe(true);
    expect(stored.vendor).toBe('ACME');
  });

  it('uses AI extracted text when OCR returns nothing', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
    mockOcr.isEnabled.mockReturnValue(true);
    mockOcr.extract.mockResolvedValue(null);
    mockAi.analyzeDocument.mockResolvedValue({
      extractedText: 'AI inferred text',
      summary: 'AI summary',
      extractedData: {},
    });

    await processor.process(makeJob());

    const persistCall = mockPrisma.document.update.mock.calls[1][0];
    expect(persistCall.data.ocr_text).toBe('AI inferred text');
    const stored = JSON.parse(persistCall.data.extracted_data_json);
    expect(stored.ocr_extraction).toBe(false);
    expect(stored.ai_extraction).toBe(true);
  });

  it('records ocr_error and continues when OCR throws', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
    mockOcr.isEnabled.mockReturnValue(true);
    mockOcr.extract.mockRejectedValue(new Error('pdf corrupt'));
    mockAi.analyzeDocument.mockResolvedValue(null);

    const result = await processor.process(makeJob());

    expect(result?.status).toBe('PROCESSED');
    const persistCall = mockPrisma.document.update.mock.calls[1][0];
    const stored = JSON.parse(persistCall.data.extracted_data_json);
    expect(stored.ocr_extraction).toBe(false);
    expect(stored.ocr_error).toBe('pdf corrupt');
  });

  it('records ai_error and continues when AI throws', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
    mockAi.analyzeDocument.mockRejectedValue(new Error('rate limited'));

    const result = await processor.process(makeJob());

    expect(result?.status).toBe('PROCESSED');
    const persistCall = mockPrisma.document.update.mock.calls[1][0];
    const stored = JSON.parse(persistCall.data.extracted_data_json);
    expect(stored.ai_extraction).toBe(false);
    expect(stored.ai_error).toBe('rate limited');
  });

  it('marks document FAILED when persistence fails', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
    mockAi.analyzeDocument.mockResolvedValue(null);
    // First update (status: PROCESSING) succeeds
    mockPrisma.document.update.mockResolvedValueOnce(baseDoc);
    // Second update (final persist) fails
    mockPrisma.document.update.mockRejectedValueOnce(new Error('db down'));
    // Recovery update (mark FAILED) succeeds
    mockPrisma.document.update.mockResolvedValueOnce({});

    await expect(processor.process(makeJob())).rejects.toThrow('db down');

    const lastCall = mockPrisma.document.update.mock.calls[2][0];
    expect(lastCall.data.status).toBe('FAILED');
  });

  it('skips OCR when storage_key is "pending"', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({ ...baseDoc, storage_key: 'pending' });
    mockOcr.isEnabled.mockReturnValue(true);
    mockAi.analyzeDocument.mockResolvedValue(null);

    await processor.process(makeJob());

    expect(mockOcr.extract).not.toHaveBeenCalled();
  });
});
