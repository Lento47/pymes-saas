import { AiTokenMeteringService } from "./ai-token-metering.service";

describe("AiTokenMeteringService", () => {
  function makeService(txOverrides: Record<string, any>) {
    const tx = {
      workspaceAiTokenBalance: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      aiTokenReservation: {
        create: jest.fn().mockResolvedValue({ id: "reservation-1" }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      aiTokenTransaction: {
        create: jest.fn().mockResolvedValue({}),
      },
      $queryRawUnsafe: jest.fn(),
      ...txOverrides,
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
      workspaceAiTokenBalance: {
        findUnique: jest.fn(),
      },
      aiTokenTransaction: {
        findMany: jest.fn(),
      },
    };
    return { service: new AiTokenMeteringService(prisma as any), tx, prisma };
  }

  it("does not reserve tokens when available balance is insufficient", async () => {
    const { service, tx } = makeService({
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      workspaceAiTokenBalance: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 100, reserved: 25 }),
        update: jest.fn(),
      },
    });

    const result = await service.reserveTokens("ws-1", 200, { conversationId: "conv-1" });

    expect(result).toEqual({
      success: false,
      reservationId: null,
      reservedTokens: 200,
      balance: { balance: 100, reserved: 25, available: 75 },
    });
    expect(tx.aiTokenReservation.create).not.toHaveBeenCalled();
  });

  it("reserves tokens atomically when balance is available", async () => {
    const { service, tx } = makeService({
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ balance: 500, reserved: 150 }]),
    });

    const result = await service.reserveTokens("ws-1", 150, { conversationId: "conv-1" });

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(expect.any(String), 150, "ws-1");
    expect(tx.aiTokenReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspace_id: "ws-1",
          amount: 150,
          conversation_id: "conv-1",
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      reservationId: "reservation-1",
      reservedTokens: 150,
      balance: { balance: 500, reserved: 150, available: 350 },
    });
  });

  it("consumes real usage and refunds the unused reservation amount", async () => {
    const { service, tx } = makeService({
      workspaceAiTokenBalance: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce({ balance: 500, reserved: 200 })
          .mockResolvedValueOnce({ balance: 390, reserved: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      aiTokenReservation: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: "reservation-1", amount: 200 }),
        update: jest.fn().mockResolvedValue({}),
      },
    });

    const result = await service.consumeReservation(
      "ws-1",
      "reservation-1",
      {
        prompt_tokens: 80,
        completion_tokens: 30,
        total_tokens: 110,
        estimated: false,
        provider: "workers-ai",
        model: "@cf/test/model",
      },
      { conversationId: "conv-1", messageId: "msg-1" },
    );

    expect(tx.workspaceAiTokenBalance.update).toHaveBeenCalledWith({
      where: { workspace_id: "ws-1" },
      data: {
        balance: { decrement: 110 },
        reserved: { decrement: 200 },
      },
    });
    expect(tx.aiTokenTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: -110,
          total_tokens: 110,
          estimated: false,
          provider: "workers-ai",
          model: "@cf/test/model",
          conversation_id: "conv-1",
          message_id: "msg-1",
        }),
      }),
    );
    expect(result).toEqual({ balance: 390, reserved: 0, available: 390 });
  });

  it("releases the full reservation on provider failure", async () => {
    const { service, tx } = makeService({
      workspaceAiTokenBalance: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 500, reserved: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      aiTokenReservation: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: "reservation-1", amount: 200 }),
        update: jest.fn().mockResolvedValue({}),
      },
    });

    const result = await service.releaseReservation("ws-1", "reservation-1");

    expect(tx.workspaceAiTokenBalance.update).toHaveBeenCalledWith({
      where: { workspace_id: "ws-1" },
      data: { reserved: { decrement: 200 } },
    });
    expect(tx.aiTokenReservation.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: { status: "RELEASED", completed_at: expect.any(Date) },
    });
    expect(result).toEqual({ balance: 500, reserved: 0, available: 500 });
  });
});
