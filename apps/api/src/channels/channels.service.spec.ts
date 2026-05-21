import { Test, type TestingModule } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ChannelsService } from "./channels.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { TelegramService } from "../telegram/telegram.service";

const mockPrisma = {
  channel: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockCrypto = {
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn(),
};

const mockTelegram = {
  validateToken: jest.fn(),
  registerWebhook: jest.fn(),
  removeWebhook: jest.fn(),
};

describe("ChannelsService", () => {
  let service: ChannelsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: TelegramService, useValue: mockTelegram },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
  });

  describe("create", () => {
    it("creates a channel with PENDING_SETUP status", async () => {
      mockPrisma.channel.create.mockResolvedValue({
        id: "ch-1",
        type: "WHATSAPP",
        name: "WhatsApp Sales",
        status: "PENDING_SETUP",
      });

      const result = await service.create("ws-1", {
        type: "WHATSAPP",
        name: "WhatsApp Sales",
      });

      expect(result.status).toBe("PENDING_SETUP");
      expect(mockPrisma.channel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspace_id: "ws-1",
            type: "WHATSAPP",
            name: "WhatsApp Sales",
            provider: "whatsapp",
          }),
        }),
      );
    });

    it("uses explicit provider when provided", async () => {
      mockPrisma.channel.create.mockResolvedValue({ id: "ch-2", status: "PENDING_SETUP" });

      await service.create("ws-1", { type: "EMAIL", name: "Support", provider: "resend" });

      expect(mockPrisma.channel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ provider: "resend" }),
        }),
      );
    });
  });

  describe("findAll", () => {
    it("returns active channels with sanitised config", async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: "ch-1",
          type: "EMAIL",
          name: "Support",
          status: "ACTIVE",
          config_json: { api_key_encrypted: "secret123", from_email: "s@test.com" },
        },
      ]);

      const result = await service.findAll("ws-1");

      expect(result).toHaveLength(1);
      // Sanitised: encrypted fields removed, rest in config property
      expect(result[0].config).toEqual({ from_email: "s@test.com" });
      expect(result[0].config.api_key_encrypted).toBeUndefined();
    });

    it("excludes INACTIVE channels by default", async () => {
      mockPrisma.channel.findMany.mockResolvedValue([]);

      await service.findAll("ws-1");

      expect(mockPrisma.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: "INACTIVE" } }),
        }),
      );
    });

    it("includes inactive channels when requested", async () => {
      mockPrisma.channel.findMany.mockResolvedValue([]);

      await service.findAll("ws-1", true);

      expect(mockPrisma.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspace_id: "ws-1" },
        }),
      );
    });
  });

  describe("findOne", () => {
    it("returns sanitised channel by ID", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: "ch-1",
        type: "WHATSAPP",
        name: "WA",
        status: "ACTIVE",
        config_json: { access_token_encrypted: "secret", phone_number_id: "123" },
      });

      const result = await service.findOne("ws-1", "ch-1");

      expect(result.config).toEqual({ phone_number_id: "123" });
    });

    it("throws NotFoundException for missing channel", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue(null);

      await expect(service.findOne("ws-1", "ch-999")).rejects.toThrow(NotFoundException);
    });
  });

  describe("configureEmail", () => {
    it("encrypts API key and updates config", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: "ch-1",
        type: "EMAIL",
        config_json: {},
      });
      mockPrisma.channel.update.mockResolvedValue({
        id: "ch-1",
        status: "ACTIVE",
        config_json: {},
      });
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await service.configureEmail("ws-1", "ch-1", {
        from_name: "Support",
        from_email: "support@test.com",
        api_key: "re_abc123",
      });

      expect(mockCrypto.encrypt).toHaveBeenCalledWith("re_abc123");
      expect(mockPrisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ACTIVE",
            config_json: expect.objectContaining({
              api_key_encrypted: "enc:re_abc123",
              from_email: "support@test.com",
              from_name: "Support",
            }),
          }),
        }),
      );
    });

    it("throws BadRequestException for non-EMAIL channel", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({ id: "ch-1", type: "WHATSAPP" });

      await expect(
        service.configureEmail("ws-1", "ch-1", {
          from_name: "S",
          from_email: "s@t.com",
          api_key: "x",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("configureWhatsApp", () => {
    it("encrypts access token and app secret", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: "ch-1",
        type: "WHATSAPP",
        config_json: {},
      });
      mockPrisma.channel.update.mockResolvedValue({
        id: "ch-1",
        status: "ACTIVE",
        config_json: {},
      });
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await service.configureWhatsApp("ws-1", "ch-1", {
        access_token: "wa-token",
        app_secret: "wa-secret",
        phone_number_id: "12345",
        waba_id: "waba-1",
      });

      expect(mockCrypto.encrypt).toHaveBeenCalledWith("wa-token");
      expect(mockCrypto.encrypt).toHaveBeenCalledWith("wa-secret");
    });

    it("rejects non-WHATSAPP channel type", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({ id: "ch-1", type: "EMAIL" });

      await expect(
        service.configureWhatsApp("ws-1", "ch-1", {
          access_token: "t",
          phone_number_id: "123",
          waba_id: "waba-1",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    it("soft-deletes by marking channel as INACTIVE", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: "ch-1",
        workspace_id: "ws-1",
        type: "WHATSAPP",
      });
      mockPrisma.channel.update.mockResolvedValue({});

      const result = await service.remove("ws-1", "ch-1");

      expect(mockPrisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "INACTIVE" },
        }),
      );
      expect(result.message).toContain("desactivado");
    });

    it("throws ForbiddenException when channel does not belong to workspace", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: "ch-1",
        workspace_id: "ws-2",
      });

      await expect(service.remove("ws-1", "ch-1")).rejects.toThrow(ForbiddenException);
    });

    it("cleans up Telegram webhook for TELEGRAM channels", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: "ch-1",
        workspace_id: "ws-1",
        type: "TELEGRAM",
      });
      mockPrisma.channel.update.mockResolvedValue({});
      mockTelegram.removeWebhook.mockResolvedValue(undefined);

      await service.remove("ws-1", "ch-1");

      expect(mockTelegram.removeWebhook).toHaveBeenCalledWith("ch-1");
    });
  });

  describe("connect / disconnect", () => {
    it("connect activates channel", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({ id: "ch-1", workspace_id: "ws-1" });
      mockPrisma.channel.update.mockResolvedValue({ id: "ch-1", status: "ACTIVE" });

      const result = await service.connect("ws-1", "ch-1");

      expect(result.status).toBe("ACTIVE");
    });

    it("disconnect deactivates channel", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({ id: "ch-1", workspace_id: "ws-1" });
      mockPrisma.channel.update.mockResolvedValue({ id: "ch-1", status: "INACTIVE" });

      const result = await service.disconnect("ws-1", "ch-1");

      expect(result.status).toBe("INACTIVE");
    });
  });

  describe("update", () => {
    it("updates channel name and status", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({ id: "ch-1", workspace_id: "ws-1" });
      mockPrisma.channel.update.mockResolvedValue({
        id: "ch-1",
        status: "ACTIVE",
        name: "New Name",
        config_json: {},
      });

      const result = await service.update("ws-1", "ch-1", { name: "New Name", status: "ACTIVE" });

      // Sanitised: name is in the rest-spread, config is separate
      expect((result as any).name).toBe("New Name");
    });
  });

  describe("assertOwnership", () => {
    it("throws ForbiddenException for cross-workspace access", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({ id: "ch-1", workspace_id: "ws-2" });

      await expect(service.update("ws-1", "ch-1", { name: "X" })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
