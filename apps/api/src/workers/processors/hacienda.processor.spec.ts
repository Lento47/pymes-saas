import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { HaciendaProcessor } from "./hacienda.processor";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StorageService } from "../../common/storage/storage.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { HaciendaRecepcionService } from "../../hacienda/hacienda-recepcion.service";
import { HaciendaSigningService } from "../../hacienda/hacienda-signing.service";
import { HaciendaXmlBuilderService } from "../../hacienda/hacienda-xml-builder.service";
import { HaciendaXmlValidatorService } from "../../hacienda/hacienda-xml-validator.service";
import { FiscalSequenceService } from "../../hacienda/fiscal-sequence.service";
import { HaciendaStatus, WorkspaceUserRole, FiscalCertificateStatus } from "@prisma/client";
import { QUEUE_NAMES } from "../queues.constants";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeJob(
  data: { invoiceId: string; workspaceId: string },
  { attemptsMade = 0, totalAttempts = 10 }: { attemptsMade?: number; totalAttempts?: number } = {},
): Job {
  return {
    id: "test-job-1",
    data,
    attemptsMade,
    opts: { attempts: totalAttempts },
  } as unknown as Job;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

function makeInvoice(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "inv-1",
    workspace_id: "ws-1",
    hacienda_status: HaciendaStatus.PENDING_SUBMISSION,
    clave: "50601012200100012345678901234567890123456789",
    consecutivo: "00100100101000000001",
    issue_date: new Date(),
    created_at: new Date(),
    amount: 1000,
    description: "Servicio",
    lines: [],
    contact: { identification_type: null, identification_number: null },
    ...overrides,
  };
}

// ─── Mock factory ────────────────────────────────────────────────────────────

const mockPrisma = {
  invoice: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  workspaceUser: {
    findMany: jest.fn(),
  },
  fiscalCertificate: {
    findMany: jest.fn(),
  },
};

const mockStorage = { upload: jest.fn() };
const mockNotifications = { create: jest.fn() };
const mockRecepcion = { submitComprobante: jest.fn(), getRecepcionStatus: jest.fn() };
const mockSigning = { signXml: jest.fn() };
const mockXmlBuilder = { buildInvoiceXml: jest.fn() };
const mockXmlValidator = { validate: jest.fn() };
const mockFiscalSequence = { nextConsecutivo: jest.fn(), generateClave: jest.fn() };
const mockQueue = { add: jest.fn(), getJobs: jest.fn() };

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("HaciendaProcessor", () => {
  let processor: HaciendaProcessor;

  const defaultWorkspace = {
    settings_json: { hacienda_environment: "staging" },
    workspace_tax_profile: {
      identification_type: "01",
      identification_number: "3101234567",
    },
  };

  const defaultSignResult = { signedXml: "<SignedXml/>", signatureMode: "XADES_EPES" as const };
  const defaultRecepcionResult = { location: "https://api-stag.comprobanteselectronicos.go.cr/recepcion/v1/comprobante/12345" };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default happy-path mocks
    mockPrisma.workspace.findUnique.mockResolvedValue(defaultWorkspace);
    mockSigning.signXml.mockResolvedValue(defaultSignResult);
    mockXmlBuilder.buildInvoiceXml.mockReturnValue("<Invoice/>");
    mockXmlValidator.validate.mockReturnValue(undefined);
    mockStorage.upload.mockResolvedValue(undefined);
    mockRecepcion.submitComprobante.mockResolvedValue(defaultRecepcionResult);
    mockPrisma.invoice.update.mockResolvedValue({});
    mockNotifications.create.mockResolvedValue({ id: "notif-1" });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HaciendaProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: HaciendaRecepcionService, useValue: mockRecepcion },
        { provide: HaciendaSigningService, useValue: mockSigning },
        { provide: HaciendaXmlBuilderService, useValue: mockXmlBuilder },
        { provide: HaciendaXmlValidatorService, useValue: mockXmlValidator },
        { provide: FiscalSequenceService, useValue: mockFiscalSequence },
        { provide: getQueueToken(QUEUE_NAMES.HACIENDA), useValue: mockQueue },
      ],
    }).compile();

    processor = module.get<HaciendaProcessor>(HaciendaProcessor);
  });

  // ── process(): happy path ────────────────────────────────────────────────

  describe("process() — happy path", () => {
    it("submits invoice and marks it SUBMITTED", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice());
      const job = makeJob({ invoiceId: "inv-1", workspaceId: "ws-1" });

      await expect(processor.process(job)).resolves.toBeUndefined();

      expect(mockRecepcion.submitComprobante).toHaveBeenCalledTimes(1);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hacienda_status: HaciendaStatus.SUBMITTED }),
        }),
      );
    });

    it("skips an already ACEPTADO invoice without re-submitting", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({ hacienda_status: HaciendaStatus.ACEPTADO }),
      );
      const job = makeJob({ invoiceId: "inv-1", workspaceId: "ws-1" });

      await processor.process(job);

      expect(mockRecepcion.submitComprobante).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  // ── process(): error / retry path ────────────────────────────────────────

  describe("process() — error handling", () => {
    it("re-throws error so BullMQ can retry the job", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice());
      mockRecepcion.submitComprobante.mockRejectedValue(new Error("Connection refused"));
      const job = makeJob({ invoiceId: "inv-1", workspaceId: "ws-1" });

      await expect(processor.process(job)).rejects.toThrow("Connection refused");
    });

    it("marks invoice as ERROR on the final attempt", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice());
      mockRecepcion.submitComprobante.mockRejectedValue(new Error("Hacienda timeout"));
      // Final attempt: attemptsMade = totalAttempts - 1 = 9
      const job = makeJob({ invoiceId: "inv-1", workspaceId: "ws-1" }, { attemptsMade: 9 });

      await expect(processor.process(job)).rejects.toThrow();

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hacienda_status: HaciendaStatus.ERROR }),
        }),
      );
    });

    it("does NOT mark ERROR on intermediate attempts", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice());
      mockRecepcion.submitComprobante.mockRejectedValue(new Error("Temporary error"));
      const job = makeJob({ invoiceId: "inv-1", workspaceId: "ws-1" }, { attemptsMade: 4 });

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });

    it("throws if invoice is not found", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      const job = makeJob({ invoiceId: "missing", workspaceId: "ws-1" });

      await expect(processor.process(job)).rejects.toThrow("no encontrada");
    });
  });

  // ── process(): contingency deadline (Ley 8001 CR) ───────────────────────

  describe("process() — contingency deadline (Ley 8001 CR)", () => {
    it("rejects invoices older than 8 days (contingency window expired)", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({ issue_date: daysAgo(9), created_at: daysAgo(9) }),
      );
      const job = makeJob({ invoiceId: "inv-old", workspaceId: "ws-1" });

      await expect(processor.process(job)).rejects.toThrow("plazo de contingencia");
    });

    it("accepts invoices exactly at the edge of the 8-day window", async () => {
      // 7 days old is still within the 8-day window
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({ issue_date: daysAgo(7), created_at: daysAgo(7) }),
      );
      const job = makeJob({ invoiceId: "inv-edge", workspaceId: "ws-1" });

      await expect(processor.process(job)).resolves.toBeUndefined();
      expect(mockRecepcion.submitComprobante).toHaveBeenCalledTimes(1);
    });

    it("accepts a fresh invoice (issued today)", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ issue_date: new Date() }));
      const job = makeJob({ invoiceId: "inv-fresh", workspaceId: "ws-1" });

      await expect(processor.process(job)).resolves.toBeUndefined();
    });
  });

  // ── process(): Nota de Crédito (NC) ─────────────────────────────────────

  describe("process() — Nota de Crédito (NC)", () => {
    it("submits an NC referencing the original invoice", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({
          document_type: "NOTA_CREDITO",
          reference_invoice_id: "inv-original",
          clave: "50601012200100012345678901234567890123456780",
        }),
      );
      const job = makeJob({ invoiceId: "inv-nc", workspaceId: "ws-1" });

      await expect(processor.process(job)).resolves.toBeUndefined();

      expect(mockXmlBuilder.buildInvoiceXml).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice: expect.objectContaining({ document_type: "NOTA_CREDITO" }),
        }),
      );
      expect(mockRecepcion.submitComprobante).toHaveBeenCalledTimes(1);
    });
  });

  // ── checkCertificateExpiry() ─────────────────────────────────────────────

  describe("checkCertificateExpiry()", () => {
    it("notifies OWNER and ADMIN users when a cert expires in 30 days", async () => {
      mockPrisma.fiscalCertificate.findMany.mockImplementation(({ where }) => {
        // Only return certs for the 30-day window
        const windowStart = where.valid_until.gte as Date;
        const daysUntil = Math.round((windowStart.getTime() - Date.now()) / 86_400_000);
        if (daysUntil >= 29 && daysUntil <= 30) {
          return Promise.resolve([
            {
              workspace_id: "ws-1",
              environment: "production",
              valid_until: daysFromNow(30),
              subject: "CN=Test",
            },
          ]);
        }
        return Promise.resolve([]);
      });

      mockPrisma.workspaceUser.findMany.mockResolvedValue([
        { user_id: "user-owner" },
        { user_id: "user-admin" },
      ]);

      await processor.checkCertificateExpiry();

      expect(mockNotifications.create).toHaveBeenCalledWith(
        "ws-1",
        expect.objectContaining({
          type: "cert_expiry_alert",
          title: "Certificado fiscal vence en 30 días",
        }),
      );
      expect(mockNotifications.create).toHaveBeenCalledTimes(2); // owner + admin
    });

    it("sends an urgent HOY notification for certs expiring in 1 day", async () => {
      mockPrisma.fiscalCertificate.findMany.mockImplementation(({ where }) => {
        const windowStart = where.valid_until.gte as Date;
        const daysUntil = Math.round((windowStart.getTime() - Date.now()) / 86_400_000);
        if (daysUntil >= 0 && daysUntil <= 1) {
          return Promise.resolve([
            {
              workspace_id: "ws-2",
              environment: "production",
              valid_until: daysFromNow(1),
              subject: "CN=Urgent",
            },
          ]);
        }
        return Promise.resolve([]);
      });

      mockPrisma.workspaceUser.findMany.mockResolvedValue([{ user_id: "user-1" }]);

      await processor.checkCertificateExpiry();

      expect(mockNotifications.create).toHaveBeenCalledWith(
        "ws-2",
        expect.objectContaining({
          type: "cert_expiry_alert",
          body: expect.stringContaining("HOY"),
        }),
      );
    });

    it("does nothing when no certificates are expiring", async () => {
      mockPrisma.fiscalCertificate.findMany.mockResolvedValue([]);

      await processor.checkCertificateExpiry();

      expect(mockNotifications.create).not.toHaveBeenCalled();
      expect(mockPrisma.workspaceUser.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Signing mode enforcement ─────────────────────────────────────────────

  describe("process() — signing mode enforcement", () => {
    it("throws when signing is required in production but XML is unsigned", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        workspace_tax_profile: defaultWorkspace.workspace_tax_profile,
        settings_json: {
          hacienda_environment: "production",
          hacienda_signing_enabled: true,
        },
      });
      mockSigning.signXml.mockResolvedValue({ signedXml: "<Xml/>", signatureMode: "UNSIGNED_PLACEHOLDER" });
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice());

      const job = makeJob({ invoiceId: "inv-1", workspaceId: "ws-1" });

      await expect(processor.process(job)).rejects.toThrow("No se pudo firmar");
    });

    it("throws when signing is disabled but environment is production", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        workspace_tax_profile: defaultWorkspace.workspace_tax_profile,
        settings_json: {
          hacienda_environment: "production",
          hacienda_signing_enabled: false,
        },
      });
      mockSigning.signXml.mockResolvedValue({ signedXml: "<Xml/>", signatureMode: "UNSIGNED_PLACEHOLDER" });
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice());

      const job = makeJob({ invoiceId: "inv-1", workspaceId: "ws-1" });

      await expect(processor.process(job)).rejects.toThrow("firma digital");
    });
  });
});
