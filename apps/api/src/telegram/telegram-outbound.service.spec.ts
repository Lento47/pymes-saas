import { NotFoundException } from "@nestjs/common";
import { CryptoService } from "../common/crypto/crypto.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { Telegraf } from "telegraf";
import { TelegramOutboundService } from "./telegram-outbound.service";

const mockSendMessage = jest.fn();

jest.mock("telegraf", () => ({
  Telegraf: jest.fn(),
}), { virtual: true });

describe("TelegramOutboundService", () => {
  const prisma = {
    channel: {
      findFirst: jest.fn(),
    },
  };

  const crypto = {
    decrypt: jest.fn(),
  };

  let service: TelegramOutboundService;

  beforeEach(() => {
    jest.clearAllMocks();
    (Telegraf as unknown as jest.Mock).mockImplementation(() => ({
      telegram: { sendMessage: mockSendMessage },
    }));
    service = new TelegramOutboundService(
      prisma as unknown as PrismaService,
      crypto as unknown as CryptoService,
    );
  });

  it("sends text messages using the decrypted Telegram bot token", async () => {
    prisma.channel.findFirst.mockResolvedValue({
      config_json: { bot_token_encrypted: "enc-token" },
    });
    crypto.decrypt.mockReturnValue("plain-token");
    mockSendMessage.mockResolvedValue({ message_id: 123 });

    const result = await service.sendMessage("ch_1", "987654321", "Hola");

    expect(result).toEqual({ message_id: 123 });
    expect(prisma.channel.findFirst).toHaveBeenCalledWith({
      where: { id: "ch_1", type: "TELEGRAM", status: "ACTIVE" },
      select: { config_json: true },
    });
    expect(crypto.decrypt).toHaveBeenCalledWith("enc-token");
    expect(Telegraf).toHaveBeenCalledWith("plain-token");
    expect(mockSendMessage).toHaveBeenCalledWith("987654321", "Hola", {
      parse_mode: "HTML",
    });
  });

  it("fails when no active Telegram bot token is configured", async () => {
    prisma.channel.findFirst.mockResolvedValue(null);

    await expect(service.sendMessage("ch_1", "987654321", "Hola")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
