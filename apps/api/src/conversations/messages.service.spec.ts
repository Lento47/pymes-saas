import { MessagesService } from "./messages.service";

describe("MessagesService", () => {
  function makeService(prisma: any) {
    return new MessagesService(
      prisma,
      { touchLastMessage: jest.fn() } as any,
      { emitNewMessage: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  function message(id: string, sentAt: Date) {
    return {
      id,
      workspace_id: "ws-1",
      conversation_id: "conv-1",
      direction: "OUTBOUND",
      body_text: id,
      sent_at: sentAt,
      created_at: sentAt,
      message_type: "TEXT",
      delivery_status: "SENT",
      raw_payload_json: null,
      attachments_json: null,
    };
  }

  it("returns the latest page of messages in ascending chronological order", async () => {
    const newestDesc = [
      message("m-5", new Date("2026-05-05T00:00:00.000Z")),
      message("m-4", new Date("2026-05-04T00:00:00.000Z")),
    ];
    const prisma = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: "conv-1" }) },
      message: {
        findMany: jest.fn().mockResolvedValue(newestDesc),
        count: jest.fn().mockResolvedValue(5),
      },
    };
    const service = makeService(prisma);

    const result = await service.findAll("ws-1", "conv-1", 1, 2);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 2,
        orderBy: [{ sent_at: "desc" }, { created_at: "desc" }],
      }),
    );
    expect(result.data.map((m: any) => m.id)).toEqual(["m-4", "m-5"]);
    expect(result.meta).toEqual({ total: 5, page: 1, limit: 2, pages: 3 });
  });
});
