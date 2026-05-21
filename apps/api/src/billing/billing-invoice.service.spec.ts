import { Test, type TestingModule } from "@nestjs/testing";
import { BillingInvoiceService } from "./billing-invoice.service";
import { PrismaService } from "../common/prisma/prisma.service";

// Mock generateBillingInvoicePdf to avoid PDFKit dependency
jest.mock("./billing-invoice-pdf.service", () => ({
  generateBillingInvoicePdf: jest.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

const mockTx = {
  billingInvoice: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockPrisma = {
  billingInvoice: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockTx)),
};

describe("BillingInvoiceService", () => {
  let service: BillingInvoiceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingInvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BillingInvoiceService>(BillingInvoiceService);
  });

  describe("generateForSubscription", () => {
    const baseParams = {
      clientName: "Acme Corp",
      clientEmail: "acme@test.com",
      planName: "BUSINESS",
      planInterval: "MONTHLY",
      seats: 5,
      amount: 49.99,
    };

    it("creates invoice with sequential PH-{year}-XXXX number", async () => {
      mockTx.billingInvoice.findFirst.mockResolvedValue({
        number: "PH-2026-0003",
      });
      mockTx.billingInvoice.create.mockResolvedValue({
        id: "inv-1",
        number: "PH-2026-0004",
        total: 49.99,
      });

      const result = await service.generateForSubscription("ws-1", "sub-1", baseParams);

      expect(result.number).toBe("PH-2026-0004");
      expect(mockTx.billingInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspace_id: "ws-1",
            subscription_id: "sub-1",
            status: "PAID",
            client_name: "Acme Corp",
            plan_name: "BUSINESS",
            seats: 5,
            subtotal: 49.99,
            total: 49.99,
          }),
        }),
      );
    });

    it("starts sequence at 0001 when no prior invoices exist", async () => {
      mockTx.billingInvoice.findFirst.mockResolvedValue(null);
      mockTx.billingInvoice.create.mockResolvedValue({
        id: "inv-2",
        number: "PH-2026-0001",
        total: 100,
      });

      const result = await service.generateForSubscription("ws-1", "sub-1", {
        ...baseParams,
        amount: 100,
      });

      expect(result.number).toBe("PH-2026-0001");
      expect(mockTx.billingInvoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { number: { startsWith: `PH-${new Date().getFullYear()}-` } },
          orderBy: { number: "desc" },
        }),
      );
    });

    it("applies 13% IVA for CRC currency by default", async () => {
      mockTx.billingInvoice.findFirst.mockResolvedValue(null);
      mockTx.billingInvoice.create.mockResolvedValue({
        id: "inv-3",
        number: "PH-2026-0001",
        subtotal: 100,
        tax_amount: 13,
        total: 113,
      });

      await service.generateForSubscription("ws-1", "sub-1", {
        ...baseParams,
        amount: 100,
        currency: "CRC",
      });

      expect(mockTx.billingInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tax_rate: 13,
            tax_amount: 13,
            total: 113,
            currency: "CRC",
          }),
        }),
      );
    });

    it("uses explicit subtotal and taxAmount when provided", async () => {
      mockTx.billingInvoice.findFirst.mockResolvedValue(null);
      mockTx.billingInvoice.create.mockResolvedValue({
        id: "inv-4",
        number: "PH-2026-0001",
        subtotal: 80,
        tax_amount: 16,
        total: 96,
      });

      await service.generateForSubscription("ws-1", "sub-1", {
        ...baseParams,
        amount: 200,
        subtotal: 80,
        taxAmount: 16,
        taxRate: 20,
      });

      expect(mockTx.billingInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 80,
            tax_amount: 16,
            tax_rate: 20,
            total: 96,
          }),
        }),
      );
    });

    it("accepts a custom status parameter", async () => {
      mockTx.billingInvoice.findFirst.mockResolvedValue(null);
      mockTx.billingInvoice.create.mockResolvedValue({
        id: "inv-5",
        number: "PH-2026-0001",
        status: "PENDING",
      });

      const result = await service.generateForSubscription("ws-1", "sub-1", {
        ...baseParams,
        status: "PENDING",
      });

      expect(result.status).toBe("PENDING");
    });

    it("uses 0% tax for non-CRC currency", async () => {
      mockTx.billingInvoice.findFirst.mockResolvedValue(null);
      mockTx.billingInvoice.create.mockResolvedValue({
        id: "inv-6",
        number: "PH-2026-0001",
        subtotal: 100,
        tax_amount: 0,
        total: 100,
      });

      await service.generateForSubscription("ws-1", "sub-1", {
        ...baseParams,
        amount: 100,
        currency: "USD",
      });

      expect(mockTx.billingInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tax_rate: 0,
            tax_amount: 0,
            currency: "USD",
          }),
        }),
      );
    });
  });

  describe("getPdfBuffer", () => {
    it("returns buffer and filename for a valid invoice", async () => {
      mockPrisma.billingInvoice.findUniqueOrThrow.mockResolvedValue({
        id: "inv-1",
        number: "PH-2026-0001",
        client_name: "Acme Corp",
        client_email: "acme@test.com",
        client_company: null,
        client_address: null,
        client_tax_id: null,
        plan_name: "BUSINESS",
        plan_interval: "MONTHLY",
        seats: 5,
        line_items: [{ description: "Plan BUSINESS", quantity: 1, unitPrice: 49.99, total: 49.99 }],
        subtotal: 49.99,
        tax_rate: 0,
        tax_amount: 0,
        total: 49.99,
        currency: "USD",
        status: "PAID",
        notes: null,
        issued_at: new Date("2026-01-01"),
        due_date: null,
      });

      const result = await service.getPdfBuffer("inv-1");

      expect(result.filename).toBe("invoice-PH-2026-0001.pdf");
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });
  });

  describe("findByWorkspace", () => {
    it("returns paginated results with meta", async () => {
      const invoices = [
        { id: "inv-1", number: "PH-2026-0002" },
        { id: "inv-2", number: "PH-2026-0001" },
      ];
      mockPrisma.billingInvoice.findMany.mockResolvedValue(invoices);
      mockPrisma.billingInvoice.count.mockResolvedValue(2);

      const result = await service.findByWorkspace("ws-1");

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.pages).toBe(1);
    });

    it("applies search filter across number, client_name, plan_name, status", async () => {
      mockPrisma.billingInvoice.findMany.mockResolvedValue([]);
      mockPrisma.billingInvoice.count.mockResolvedValue(0);

      await service.findByWorkspace("ws-1", { search: "acme" });

      expect(mockPrisma.billingInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspace_id: "ws-1",
            OR: expect.arrayContaining([
              { number: { contains: "acme", mode: "insensitive" } },
              { client_name: { contains: "acme", mode: "insensitive" } },
              { plan_name: { contains: "acme", mode: "insensitive" } },
              { status: { contains: "acme", mode: "insensitive" } },
            ]),
          }),
        }),
      );
    });

    it("caps limit at 100", async () => {
      mockPrisma.billingInvoice.findMany.mockResolvedValue([]);
      mockPrisma.billingInvoice.count.mockResolvedValue(0);

      await service.findByWorkspace("ws-1", { limit: 200 });

      expect(mockPrisma.billingInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });
});
