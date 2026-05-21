import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PipelineService } from "./pipeline.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDealStage = {
  count: jest.fn(),
  createMany: jest.fn(),
  findMany: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  aggregate: jest.fn(),
};

const mockDeal = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockInvoice = {
  count: jest.fn(),
  create: jest.fn(),
};

const mockWorkspace = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

// $transaction: runs the callback with the same mock (tx === mockPrisma)
// Use an interface to avoid self-referencing type error
interface MockTx {
  dealStage: typeof mockDealStage;
  deal: typeof mockDeal;
  invoice: typeof mockInvoice;
  workspace: typeof mockWorkspace;
}

const mockPrisma: MockTx & { $transaction: jest.Mock } = {
  dealStage: mockDealStage,
  deal: mockDeal,
  invoice: mockInvoice,
  workspace: mockWorkspace,
  $transaction: jest.fn((cb: (tx: MockTx) => Promise<any>): Promise<any> => cb(mockPrisma)),
};

const mockNotifications = {
  create: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ID = "ws-001";

function stage(overrides: Record<string, any> = {}) {
  return {
    id: "stg-1",
    workspace_id: WORKSPACE_ID,
    name: "Prospecto",
    color: "#6366f1",
    order: 0,
    deals: [],
    ...overrides,
  };
}

function deal(overrides: Record<string, any> = {}) {
  return {
    id: "deal-1",
    workspace_id: WORKSPACE_ID,
    stage_id: "stg-1",
    contact_id: "ct-1",
    assigned_user_id: "usr-1",
    title: "Test Deal",
    value: 1000,
    currency: "CRC",
    priority: "MEDIUM",
    status: "OPEN",
    closing_date: null,
    notes: null,
    contact: { id: "ct-1", full_name: "Acme Corp", company_name: "Acme" },
    assigned_user: { id: "usr-1", name: "John" },
    stage: { id: "stg-1", name: "Prospecto", color: "#6366f1" },
    ...overrides,
  };
}

function invoice(overrides: Record<string, any> = {}) {
  return {
    id: "inv-1",
    number: "DEAL-2026-0001",
    amount: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("PipelineService", () => {
  let service: PipelineService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
  });

  // -----------------------------------------------------------------------
  // getStages
  // -----------------------------------------------------------------------
  describe("getStages", () => {
    it("creates default stages when none exist (count=0)", async () => {
      mockDealStage.count.mockResolvedValue(0);
      mockDealStage.createMany.mockResolvedValue({ count: 6 });
      mockDealStage.findMany.mockResolvedValue([]);

      await service.getStages(WORKSPACE_ID);

      expect(mockDealStage.count).toHaveBeenCalledWith({
        where: { workspace_id: WORKSPACE_ID },
      });
      expect(mockDealStage.createMany).toHaveBeenCalledTimes(1);
      expect(mockDealStage.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ name: "Prospecto", workspace_id: WORKSPACE_ID, order: 0 }),
        ]),
      });
    });

    it("skips default creation when stages already exist", async () => {
      mockDealStage.count.mockResolvedValue(6);
      mockDealStage.findMany.mockResolvedValue([stage(), stage({ id: "stg-2", name: "Contactado", order: 1 })]);

      const result = await service.getStages(WORKSPACE_ID);

      expect(mockDealStage.createMany).not.toHaveBeenCalled();
      expect(mockDealStage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspace_id: WORKSPACE_ID },
          orderBy: { order: "asc" },
          include: expect.objectContaining({
            deals: expect.objectContaining({
              where: { status: "OPEN" },
            }),
          }),
        }),
      );
      expect(result).toHaveLength(2);
    });

    it("returns stages with included deals ordered by created_at desc", async () => {
      mockDealStage.count.mockResolvedValue(1);
      mockDealStage.findMany.mockResolvedValue([
        stage({
          deals: [
            deal({ id: "deal-2", title: "Newer", created_at: new Date("2026-05-20") }),
            deal({ id: "deal-1", title: "Older", created_at: new Date("2026-05-19") }),
          ],
        }),
      ]);

      const result = await service.getStages(WORKSPACE_ID);

      expect(result[0].deals).toHaveLength(2);
      expect(result[0].deals[0].id).toBe("deal-2"); // newest first
    });
  });

  // -----------------------------------------------------------------------
  // createStage
  // -----------------------------------------------------------------------
  describe("createStage", () => {
    it("aggregates max order and creates stage with order+1", async () => {
      mockDealStage.aggregate.mockResolvedValue({ _max: { order: 5 } });
      mockDealStage.create.mockResolvedValue(
        stage({ id: "stg-new", name: "Custom", color: "#ff0000", order: 6 }),
      );

      const dto = { name: "Custom", color: "#ff0000" };
      const result = await service.createStage(WORKSPACE_ID, dto);

      expect(mockDealStage.aggregate).toHaveBeenCalledWith({
        where: { workspace_id: WORKSPACE_ID },
        _max: { order: true },
      });
      expect(mockDealStage.create).toHaveBeenCalledWith({
        data: {
          workspace_id: WORKSPACE_ID,
          name: "Custom",
          color: "#ff0000",
          order: 6, // 5+1
        },
      });
      expect(result.order).toBe(6);
    });

    it("defaults order to 0 when no stages exist (_max.order is null)", async () => {
      mockDealStage.aggregate.mockResolvedValue({ _max: { order: null } });
      mockDealStage.create.mockResolvedValue(
        stage({ id: "stg-first", name: "First", color: "#6366f1", order: 0 }),
      );

      const result = await service.createStage(WORKSPACE_ID, { name: "First" });

      expect(mockDealStage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ order: 0 }), // (null ?? -1) + 1 = 0
      });
      expect(result.order).toBe(0);
    });

    it("defaults color to #6366f1 when not provided", async () => {
      mockDealStage.aggregate.mockResolvedValue({ _max: { order: 2 } });
      mockDealStage.create.mockResolvedValue(stage({ color: "#6366f1" }));

      await service.createStage(WORKSPACE_ID, { name: "No Color" });

      expect(mockDealStage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ color: "#6366f1" }),
      });
    });
  });

  // -----------------------------------------------------------------------
  // createDeal
  // -----------------------------------------------------------------------
  describe("createDeal", () => {
    it("creates a deal with the provided data", async () => {
      const created = deal();
      mockDeal.create.mockResolvedValue(created);
      mockWorkspace.findUnique.mockResolvedValue({
        id: WORKSPACE_ID,
        settings_json: { quick_start_progress: {} },
      });

      const dto = {
        stage_id: "stg-1",
        title: "Test Deal",
        contact_id: "ct-1",
        assigned_user_id: "usr-1",
        value: 1000,
        currency: "CRC",
        priority: "MEDIUM" as const,
        closing_date: "2026-06-01",
        notes: "Some notes",
      };

      const result = await service.createDeal(WORKSPACE_ID, dto);

      expect(mockDeal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspace_id: WORKSPACE_ID,
          stage_id: "stg-1",
          title: "Test Deal",
          value: 1000,
          closing_date: expect.any(Date),
        }),
        include: expect.objectContaining({
          contact: expect.any(Object),
          assigned_user: expect.any(Object),
          stage: expect.any(Object),
        }),
      });
      expect(result.id).toBe("deal-1");
    });

    it("sends notification when assigned_user_id is provided", async () => {
      const created = deal({ assigned_user_id: "usr-1" });
      mockDeal.create.mockResolvedValue(created);
      mockWorkspace.findUnique.mockResolvedValue({
        id: WORKSPACE_ID,
        settings_json: { quick_start_progress: {} },
      });

      await service.createDeal(WORKSPACE_ID, {
        stage_id: "stg-1",
        title: "Notified Deal",
        assigned_user_id: "usr-1",
      });

      expect(mockNotifications.create).toHaveBeenCalledWith(
        WORKSPACE_ID,
        expect.objectContaining({
          user_id: "usr-1",
          type: "deal_created",
          title: "Nuevo negocio creado",
          related_entity_type: "deal",
          related_entity_id: "deal-1",
        }),
      );
    });

    it("does NOT send notification when assigned_user_id is not provided", async () => {
      const created = deal({ assigned_user_id: null });
      mockDeal.create.mockResolvedValue(created);
      mockWorkspace.findUnique.mockResolvedValue({
        id: WORKSPACE_ID,
        settings_json: {},
      });

      await service.createDeal(WORKSPACE_ID, {
        stage_id: "stg-1",
        title: "Unassigned Deal",
      });

      expect(mockNotifications.create).not.toHaveBeenCalled();
    });

    it("handles notification failure gracefully (caught by logger)", async () => {
      const created = deal({ assigned_user_id: "usr-1" });
      mockDeal.create.mockResolvedValue(created);
      mockNotifications.create.mockRejectedValue(new Error("Notification failed"));
      mockWorkspace.findUnique.mockResolvedValue({
        id: WORKSPACE_ID,
        settings_json: { quick_start_progress: {} },
      });

      // Should not throw — notification errors are swallowed
      const result = await service.createDeal(WORKSPACE_ID, {
        stage_id: "stg-1",
        title: "Deal",
        assigned_user_id: "usr-1",
      });

      expect(result.id).toBe("deal-1");
    });

    it("defaults value to null, currency to CRC, and priority to MEDIUM", async () => {
      mockDeal.create.mockResolvedValue(deal({ value: null, currency: "CRC", priority: "MEDIUM" }));
      mockWorkspace.findUnique.mockResolvedValue({
        id: WORKSPACE_ID,
        settings_json: {},
      });

      await service.createDeal(WORKSPACE_ID, { stage_id: "stg-1", title: "Minimal" });

      expect(mockDeal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          value: null,
          currency: "CRC",
          priority: "MEDIUM",
          closing_date: null,
          notes: null,
        }),
        include: expect.any(Object),
      });
    });
  });

  // -----------------------------------------------------------------------
  // moveDeal
  // -----------------------------------------------------------------------
  describe("moveDeal", () => {
    it("updates stage_id of an existing deal", async () => {
      mockDeal.findFirst.mockResolvedValue(deal());
      const moved = deal({
        stage_id: "stg-2",
        stage: { id: "stg-2", name: "Contactado" },
        assigned_user_id: null,
      });
      mockDeal.update.mockResolvedValue(moved);

      const result = await service.moveDeal(WORKSPACE_ID, "deal-1", { stage_id: "stg-2" });

      expect(mockDeal.update).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        data: { stage_id: "stg-2" },
        include: {
          assigned_user: { select: { id: true } },
          stage: { select: { name: true } },
        },
      });
      expect(result.stage_id).toBe("stg-2");
    });

    it("throws NotFoundException when deal does not exist", async () => {
      mockDeal.findFirst.mockResolvedValue(null);

      await expect(
        service.moveDeal(WORKSPACE_ID, "nonexistent", { stage_id: "stg-1" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("sends notification to assigned user on move", async () => {
      mockDeal.findFirst.mockResolvedValue(deal({ assigned_user_id: "usr-2" }));
      mockDeal.update.mockResolvedValue(
        deal({
          stage_id: "stg-3",
          title: "Moving Deal",
          assigned_user_id: "usr-2",
          stage: { name: "Negociación" },
        }),
      );

      await service.moveDeal(WORKSPACE_ID, "deal-1", { stage_id: "stg-3" });

      expect(mockNotifications.create).toHaveBeenCalledWith(
        WORKSPACE_ID,
        expect.objectContaining({
          user_id: "usr-2",
          type: "deal_stage_changed",
          title: "Negocio movido de etapa",
          body: 'El negocio "Moving Deal" pasó a la etapa "Negociación".',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // winDeal
  // -----------------------------------------------------------------------
  describe("winDeal", () => {
    it("marks deal as WON and creates invoice inside a transaction", async () => {
      const existingDeal = deal({
        status: "OPEN",
        contact_id: "ct-1",
        value: 5000,
        currency: "USD",
        closing_date: new Date("2026-06-15"),
        contact: { id: "ct-1", full_name: "Acme", company_name: "Acme" },
      });
      mockDeal.findFirst.mockResolvedValue(existingDeal);
      mockInvoice.count.mockResolvedValue(10);
      mockDeal.update.mockResolvedValue(
        deal({ status: "WON", assigned_user_id: "usr-1" }),
      );
      mockInvoice.create.mockResolvedValue(invoice({ id: "inv-new", number: "DEAL-2026-0011" }));

      const result = await service.winDeal(WORKSPACE_ID, "deal-1");

      // Transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // Invoice count used for sequential numbering
      expect(mockInvoice.count).toHaveBeenCalledWith({ where: { workspace_id: WORKSPACE_ID } });
      // Deal updated to WON
      expect(mockDeal.update).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        data: { status: "WON" },
        include: { assigned_user: { select: { id: true } } },
      });
      // Invoice created with computed number
      expect(mockInvoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspace_id: WORKSPACE_ID,
          contact_id: "ct-1",
          number: "DEAL-2026-0011",
          amount: 5000,
          currency: "USD",
          status: "DRAFT",
          document_type: "FACTURA_ELECTRONICA",
        }),
      });

      expect(result.deal.status).toBe("WON");
      expect(result.invoice_number).toBe("DEAL-2026-0011");
      expect(result.invoice_id).toBe("inv-new");
    });

    it("sends won notification to assigned user", async () => {
      const existingDeal = deal({
        status: "OPEN",
        contact_id: "ct-1",
        assigned_user_id: "usr-1",
        value: 1000,
        contact: { id: "ct-1", full_name: "Acme", company_name: "Acme" },
      });
      mockDeal.findFirst.mockResolvedValue(existingDeal);
      mockInvoice.count.mockResolvedValue(0);
      mockDeal.update.mockResolvedValue(deal({ status: "WON", assigned_user_id: "usr-1" }));
      mockInvoice.create.mockResolvedValue(invoice({ number: "DEAL-2026-0001" }));

      await service.winDeal(WORKSPACE_ID, "deal-1");

      expect(mockNotifications.create).toHaveBeenCalledWith(
        WORKSPACE_ID,
        expect.objectContaining({
          user_id: "usr-1",
          type: "deal_won",
          title: "¡Negocio ganado!",
          related_entity_type: "deal",
          related_entity_id: "deal-1",
        }),
      );
    });

    it("uses deal.title as invoice description when notes is null", async () => {
      const existingDeal = deal({
        status: "OPEN",
        contact_id: "ct-1",
        value: 500,
        notes: null,
        contact: { id: "ct-1", full_name: "Acme", company_name: "Acme" },
      });
      mockDeal.findFirst.mockResolvedValue(existingDeal);
      mockInvoice.count.mockResolvedValue(0);
      mockDeal.update.mockResolvedValue(deal({ status: "WON" }));
      mockInvoice.create.mockResolvedValue(invoice());

      await service.winDeal(WORKSPACE_ID, "deal-1");

      expect(mockInvoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: "Test Deal" }),
      });
    });

    it("throws NotFoundException when deal not found", async () => {
      mockDeal.findFirst.mockResolvedValue(null);

      await expect(service.winDeal(WORKSPACE_ID, "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws BadRequestException when deal is already WON", async () => {
      mockDeal.findFirst.mockResolvedValue(deal({ status: "WON", contact: {} }));

      await expect(service.winDeal(WORKSPACE_ID, "deal-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException when deal has no contact", async () => {
      mockDeal.findFirst.mockResolvedValue(
        deal({ status: "OPEN", contact_id: null, contact: null }),
      );

      await expect(service.winDeal(WORKSPACE_ID, "deal-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("handles zero value correctly", async () => {
      const existingDeal = deal({
        status: "OPEN",
        contact_id: "ct-1",
        value: null,
        contact: { id: "ct-1", full_name: "Acme", company_name: "Acme" },
      });
      mockDeal.findFirst.mockResolvedValue(existingDeal);
      mockInvoice.count.mockResolvedValue(0);
      mockDeal.update.mockResolvedValue(deal({ status: "WON" }));
      mockInvoice.create.mockResolvedValue(invoice({ amount: 0 }));

      const result = await service.winDeal(WORKSPACE_ID, "deal-1");

      expect(mockInvoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 0 }),
      });
    });
  });

  // -----------------------------------------------------------------------
  // deleteDeal
  // -----------------------------------------------------------------------
  describe("deleteDeal", () => {
    it("deletes an existing deal", async () => {
      mockDeal.findFirst.mockResolvedValue(deal());
      mockDeal.delete.mockResolvedValue(deal());

      const result = await service.deleteDeal(WORKSPACE_ID, "deal-1");

      expect(mockDeal.findFirst).toHaveBeenCalledWith({
        where: { id: "deal-1", workspace_id: WORKSPACE_ID },
      });
      expect(mockDeal.delete).toHaveBeenCalledWith({ where: { id: "deal-1" } });
      expect(result).toEqual({ success: true });
    });

    it("throws NotFoundException when deal not found", async () => {
      mockDeal.findFirst.mockResolvedValue(null);

      await expect(service.deleteDeal(WORKSPACE_ID, "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // deleteStage
  // -----------------------------------------------------------------------
  describe("deleteStage", () => {
    it("deletes an existing stage", async () => {
      mockDealStage.findFirst.mockResolvedValue(stage());
      mockDealStage.delete.mockResolvedValue(stage());

      const result = await service.deleteStage(WORKSPACE_ID, "stg-1");

      expect(mockDealStage.findFirst).toHaveBeenCalledWith({
        where: { id: "stg-1", workspace_id: WORKSPACE_ID },
      });
      expect(mockDealStage.delete).toHaveBeenCalledWith({ where: { id: "stg-1" } });
      expect(result).toEqual({ success: true });
    });

    it("throws NotFoundException when stage not found", async () => {
      mockDealStage.findFirst.mockResolvedValue(null);

      await expect(service.deleteStage(WORKSPACE_ID, "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
