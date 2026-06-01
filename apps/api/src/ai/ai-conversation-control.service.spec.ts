jest.mock("telegraf", () => ({ Telegraf: jest.fn() }), { virtual: true });

const { AiConversationControlService } = require("./ai-conversation-control.service");

describe("AiConversationControlService", () => {
  function makeService(overrides: Record<string, any> = {}) {
    const prisma = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "conv-1",
          metadata_json: { ai_state: "AI_ACTIVE" },
          channel_id: null,
          contact: null,
          channel: null,
        }),
        update: jest.fn(),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      messageTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ...overrides.prisma,
    };
    const cloudflare = {
      isConfigured: true,
      chatCompletionWithUsage: jest.fn(),
      ...overrides.cloudflare,
    };
    const emprendeAi = {
      buildBusinessContext: jest.fn().mockResolvedValue({
        aiAgentProvider: "workers_ai",
        aiAgentModel: "@cf/test/model",
      }),
      buildSystemPrompt: jest.fn().mockReturnValue("system prompt"),
      ...overrides.emprendeAi,
    };
    const events = {
      emitNewMessage: jest.fn(),
      emitMessageStatus: jest.fn(),
      ...overrides.events,
    };
    const whatsapp = overrides.whatsapp ?? {};
    const telegramOutbound = overrides.telegramOutbound ?? {};
    const planLimits = {
      enforcePlanTier: jest.fn().mockResolvedValue(undefined),
      ...overrides.planLimits,
    };
    const contactMemory = {
      getActiveProfile: jest.fn().mockResolvedValue(null),
      upsertProfile: jest.fn(),
      ...overrides.contactMemory,
    };
    const aiTokens = {
      estimateMessagesTokens: jest.fn().mockReturnValue(900),
      reserveTokens: jest.fn(),
      releaseReservation: jest.fn().mockResolvedValue({ balance: 1000, reserved: 0, available: 1000 }),
      consumeReservation: jest.fn(),
      getBalance: jest.fn().mockResolvedValue({ balance: 1000, reserved: 0, available: 1000 }),
      ...overrides.aiTokens,
    };

    return {
      service: new AiConversationControlService(
        prisma as any,
        cloudflare as any,
        emprendeAi as any,
        events as any,
        whatsapp as any,
        telegramOutbound as any,
        planLimits as any,
        contactMemory as any,
        aiTokens as any,
      ),
      prisma,
      cloudflare,
      aiTokens,
    };
  }

  it("does not call the model when token reservation fails", async () => {
    const { service, cloudflare, aiTokens } = makeService({
      aiTokens: {
        reserveTokens: jest.fn().mockResolvedValue({
          success: false,
          reservationId: null,
          reservedTokens: 900,
          balance: { balance: 100, reserved: 0, available: 100 },
        }),
      },
    });

    const result = await service.replyToInbound("ws-1", "conv-1", "hola");

    expect(result).toEqual({
      ok: false,
      error: "INSUFFICIENT_AI_TOKENS",
      balance: { balance: 100, reserved: 0, available: 100 },
      ai_state: "AI_ACTIVE",
    });
    expect(aiTokens.reserveTokens).toHaveBeenCalled();
    expect(cloudflare.chatCompletionWithUsage).not.toHaveBeenCalled();
  });

  it("releases the reservation when the provider fails before generating a response", async () => {
    const { service, cloudflare, aiTokens } = makeService({
      aiTokens: {
        reserveTokens: jest.fn().mockResolvedValue({
          success: true,
          reservationId: "reservation-1",
          reservedTokens: 900,
          balance: { balance: 1000, reserved: 900, available: 100 },
        }),
      },
      cloudflare: {
        chatCompletionWithUsage: jest.fn().mockRejectedValue(new Error("provider down")),
      },
    });

    const result = await service.replyToInbound("ws-1", "conv-1", "hola");

    expect(cloudflare.chatCompletionWithUsage).toHaveBeenCalled();
    expect(aiTokens.releaseReservation).toHaveBeenCalledWith("ws-1", "reservation-1");
    expect(aiTokens.consumeReservation).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: "AI_PROVIDER_FAILED" });
  });
});
