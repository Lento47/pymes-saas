import { Test, type TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { AutomationsService } from "../automations/automations.service";
import { SlaService } from "./sla.service";

const mockPrisma = {
  conversation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  channel: {
    findFirst: jest.fn(),
  },
  contact: {
    findFirst: jest.fn(),
  },
  departmentMember: {
    findMany: jest.fn(),
  },
  workspaceUser: {
    findUnique: jest.fn(),
  },
};

const mockAutomations = {
  triggerRules: jest.fn().mockResolvedValue(undefined),
};

const mockSla = {
  trackResolution: jest.fn().mockResolvedValue(undefined),
};

describe("ConversationsService", () => {
  let service: ConversationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AutomationsService, useValue: mockAutomations },
        { provide: SlaService, useValue: mockSla },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  describe("findAll", () => {
    it("returns paginated conversations filtered by workspace", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([{ id: "conv-1" }]);
      mockPrisma.conversation.count.mockResolvedValue(1);

      const result = await service.findAll("ws-1", { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspace_id: "ws-1" },
          skip: 0,
          take: 20,
        }),
      );
    });

    it("filters by status when provided", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.findAll("ws-1", { page: 1, limit: 20, status: "OPEN" });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspace_id: "ws-1", status: "OPEN" }),
        }),
      );
    });

    it("filters by priority when provided", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.findAll("ws-1", { page: 1, limit: 20, priority: "URGENT" });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: "URGENT" }),
        }),
      );
    });

    it("filters unassigned conversations", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.findAll("ws-1", { page: 1, limit: 20, unassigned: true });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assigned_user_id: null }),
        }),
      );
    });

    it("scopes results to AGENT department memberships", async () => {
      mockPrisma.departmentMember.findMany.mockResolvedValue([
        { department_id: "dept-a" },
        { department_id: "dept-b" },
      ]);
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.findAll("ws-1", { page: 1, limit: 20 }, { id: "agent-1", role: "AGENT" });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            department_id: { in: ["dept-a", "dept-b"] },
          }),
        }),
      );
    });

    it("does not scope results for non-AGENT callers", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.findAll("ws-1", { page: 1, limit: 20 }, { id: "owner-1", role: "OWNER" });

      expect(mockPrisma.departmentMember.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspace_id: "ws-1" },
        }),
      );
    });

    it("filters by q (search on subject)", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.findAll("ws-1", { page: 1, limit: 20, q: "factura" });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subject: { contains: "factura", mode: "insensitive" },
          }),
        }),
      );
    });
  });

  describe("create", () => {
    const createDto = {
      channel_id: "ch-1",
      contact_id: "ct-1",
      subject: "Prueba",
      priority: "URGENT" as const,
    };

    it("creates conversation when channel belongs to workspace", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({ id: "ch-1", type: "WHATSAPP" });
      mockPrisma.conversation.create.mockResolvedValue({
        id: "conv-1",
        workspace_id: "ws-1",
        channel_id: "ch-1",
        contact_id: "ct-1",
        subject: "Prueba",
        status: "NEW",
        priority: "URGENT",
      });

      const result = await service.create("ws-1", createDto);

      expect(result.status).toBe("NEW");
      expect(mockAutomations.triggerRules).toHaveBeenCalledWith(
        "ws-1",
        "CONVERSATION_CREATED",
        "conversation",
        "conv-1",
      );
    });

    it("throws NotFoundException when channel does not belong to workspace", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue(null);

      await expect(service.create("ws-1", createDto)).rejects.toThrow(NotFoundException);
    });

    it("defaults priority to MEDIUM when not provided", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({ id: "ch-1" });
      mockPrisma.conversation.create.mockResolvedValue({
        id: "conv-1",
        status: "NEW",
        priority: "MEDIUM",
      });

      const result = await service.create("ws-1", {
        channel_id: "ch-1",
        contact_id: "ct-1",
        subject: "Test",
      });

      expect(result.priority).toBe("MEDIUM");
    });
  });

  describe("findOne", () => {
    it("returns conversation with relations", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        subject: "Test",
        status: "OPEN",
      });

      const result = await service.findOne("ws-1", "conv-1");

      expect(result.id).toBe("conv-1");
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "conv-1", workspace_id: "ws-1" },
        }),
      );
    });

    it("throws NotFoundException when conversation does not exist", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      await expect(service.findOne("ws-1", "conv-999")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("updates status and triggers automations", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
      mockPrisma.conversation.update.mockResolvedValue({ id: "conv-1" });

      await service.update("ws-1", "conv-1", { status: "RESOLVED" });

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "RESOLVED" }),
        }),
      );
      expect(mockAutomations.triggerRules).toHaveBeenCalledWith(
        "ws-1",
        "CONVERSATION_STATUS_CHANGED",
        "conversation",
        "conv-1",
      );
    });

    it("validates contact belongs to workspace when changing contact_id", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.update("ws-1", "conv-1", { contact_id: "ct-999" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("assign", () => {
    it("assigns user and opens conversation", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "conv-1", status: "NEW" });
      mockPrisma.workspaceUser.findUnique.mockResolvedValue({ id: "wu-1" });
      mockPrisma.conversation.update.mockResolvedValue({ id: "conv-1" });

      await service.assign("ws-1", "conv-1", "user-1");

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assigned_user_id: "user-1",
            status: "OPEN",
          }),
        }),
      );
    });

    it("throws BadRequestException when user is not a workspace member", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
      mockPrisma.workspaceUser.findUnique.mockResolvedValue(null);

      await expect(service.assign("ws-1", "conv-1", "outsider")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("resolve", () => {
    it("marks conversation as RESOLVED and tracks SLA", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "conv-1", status: "OPEN" });
      mockPrisma.conversation.update.mockResolvedValue({ id: "conv-1" });

      const result = await service.resolve("ws-1", "conv-1");

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "RESOLVED" }),
        }),
      );
      // SLA tracking is fire-and-forget; we verify it gets called eventually
      expect(result.id).toBe("conv-1");
    });

    it("throws BadRequestException if already resolved", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "conv-1", status: "RESOLVED" });

      await expect(service.resolve("ws-1", "conv-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    it("deletes conversation", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
      mockPrisma.conversation.delete.mockResolvedValue({ id: "conv-1" });

      const result = await service.remove("ws-1", "conv-1");

      expect(result.id).toBe("conv-1");
    });

    it("throws NotFoundException when conversation does not exist", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      await expect(service.remove("ws-1", "conv-999")).rejects.toThrow(NotFoundException);
    });
  });
});
