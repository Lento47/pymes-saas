import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OcrService } from './ocr.service';
import { Readable } from 'stream';

describe('OcrService', () => {
  let service: OcrService;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OcrService>(OcrService);
    config = module.get(ConfigService);
  });

  describe('isEnabled', () => {
    it('returns false when env var is not set', () => {
      config.get.mockReturnValue(undefined);
      expect(service.isEnabled()).toBe(false);
    });

    it('returns true when DOCUMENT_OCR_ENABLED=1', () => {
      config.get.mockReturnValue('1');
      expect(service.isEnabled()).toBe(true);
    });

    it('returns true when DOCUMENT_OCR_ENABLED=true', () => {
      config.get.mockReturnValue('true');
      expect(service.isEnabled()).toBe(true);
    });

    it('returns false for other truthy strings', () => {
      config.get.mockReturnValue('yes');
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('streamToBuffer', () => {
    it('converts a readable stream to a buffer', async () => {
      const stream = Readable.from([Buffer.from('hello'), Buffer.from(' world')]);
      const buf = await service.streamToBuffer(stream);
      expect(buf.toString()).toBe('hello world');
    });

    it('handles string chunks', async () => {
      const stream = Readable.from(['foo', 'bar']);
      const buf = await service.streamToBuffer(stream);
      expect(buf.toString()).toBe('foobar');
    });
  });

  describe('extract', () => {
    it('returns null when OCR is disabled', async () => {
      config.get.mockReturnValue(undefined);
      const result = await service.extract('application/pdf', 100, jest.fn());
      expect(result).toBeNull();
    });

    it('returns null when file exceeds max bytes', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'DOCUMENT_OCR_ENABLED') return '1';
        if (key === 'DOCUMENT_OCR_MAX_BYTES') return '1000';
      });
      const result = await service.extract('application/pdf', 2000, jest.fn());
      expect(result).toBeNull();
    });

    it('returns null for unsupported mime types', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'DOCUMENT_OCR_ENABLED') return '1';
      });
      const result = await service.extract('image/jpeg', 100, jest.fn());
      expect(result).toBeNull();
    });

    it('calls loadBuffer and extractFromPdf for application/pdf', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'DOCUMENT_OCR_ENABLED') return '1';
      });
      const loadBuffer = jest.fn().mockResolvedValue(Buffer.from('%PDF test'));
      jest.spyOn(service, 'extractFromPdf').mockResolvedValue('extracted text');

      const result = await service.extract('application/pdf', 100, loadBuffer);
      expect(loadBuffer).toHaveBeenCalled();
      expect(result).toBe('extracted text');
    });

    it('returns null when extractFromPdf returns null (pdf-parse missing)', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'DOCUMENT_OCR_ENABLED') return '1';
      });
      const loadBuffer = jest.fn().mockResolvedValue(Buffer.from('%PDF'));
      jest.spyOn(service, 'extractFromPdf').mockResolvedValue(null);

      const result = await service.extract('application/pdf', 100, loadBuffer);
      expect(result).toBeNull();
    });
  });
});
