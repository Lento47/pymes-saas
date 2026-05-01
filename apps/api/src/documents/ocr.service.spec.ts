import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { OcrService } from './ocr.service';

describe('OcrService', () => {
  let service: OcrService;
  let configMap: Record<string, string | undefined>;

  beforeEach(async () => {
    configMap = {};
    const mockConfig = {
      get: jest.fn((key: string) => configMap[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<OcrService>(OcrService);
  });

  describe('isEnabled', () => {
    it('returns false by default', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('returns true when env is "1"', () => {
      configMap.DOCUMENT_OCR_ENABLED = '1';
      expect(service.isEnabled()).toBe(true);
    });

    it('returns true when env is "true"', () => {
      configMap.DOCUMENT_OCR_ENABLED = 'true';
      expect(service.isEnabled()).toBe(true);
    });

    it('returns false for other values', () => {
      configMap.DOCUMENT_OCR_ENABLED = 'yes';
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('streamToBuffer', () => {
    it('collects all chunks into a single buffer', async () => {
      const stream = Readable.from([Buffer.from('hello '), Buffer.from('world')]);
      const buf = await service.streamToBuffer(stream);
      expect(buf.toString()).toBe('hello world');
    });

    it('handles string chunks', async () => {
      const stream = Readable.from(['abc', 'def']);
      const buf = await service.streamToBuffer(stream);
      expect(buf.toString()).toBe('abcdef');
    });

    it('returns empty buffer for empty stream', async () => {
      const stream = Readable.from([]);
      const buf = await service.streamToBuffer(stream);
      expect(buf.length).toBe(0);
    });
  });

  describe('extract', () => {
    const loader = jest.fn(async () => Buffer.from('fake'));

    beforeEach(() => loader.mockClear());

    it('returns null when OCR is disabled', async () => {
      const result = await service.extract('application/pdf', 1000, loader);
      expect(result).toBeNull();
      expect(loader).not.toHaveBeenCalled();
    });

    it('returns null when file exceeds max bytes', async () => {
      configMap.DOCUMENT_OCR_ENABLED = '1';
      configMap.DOCUMENT_OCR_MAX_BYTES = '500';
      const result = await service.extract('application/pdf', 1000, loader);
      expect(result).toBeNull();
      expect(loader).not.toHaveBeenCalled();
    });

    it('returns null for unsupported mime type', async () => {
      configMap.DOCUMENT_OCR_ENABLED = '1';
      const result = await service.extract('text/csv', 100, loader);
      expect(result).toBeNull();
      expect(loader).not.toHaveBeenCalled();
    });

    it('extracts PDF text when enabled', async () => {
      configMap.DOCUMENT_OCR_ENABLED = '1';
      const spy = jest.spyOn(service, 'extractFromPdf').mockResolvedValue('pdf-text');
      const result = await service.extract('application/pdf', 100, loader);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(result).toBe('pdf-text');
    });
  });
});
