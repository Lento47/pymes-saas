import { AiContextMinimizerService } from "./ai-context-minimizer.service";

describe("AiContextMinimizerService", () => {
  const service = new AiContextMinimizerService();

  it("returns an empty context when input is missing", () => {
    expect(service.minimize()).toEqual({});
  });

  it("limits recent messages to the last 8 and removes createdAt", () => {
    const result = service.minimize({
      businessName: "Demo Store",
      recentMessages: Array.from({ length: 10 }, (_, index) => ({
        role: "customer",
        content: `message-${index}`,
        createdAt: "2026-01-01T00:00:00.000Z",
      })),
    });

    expect(result.recentMessages).toHaveLength(8);
    expect(result.recentMessages?.[0].content).toBe("message-2");
    expect(result.recentMessages?.[7].content).toBe("message-9");
    expect(result.recentMessages?.[0]).not.toHaveProperty("createdAt");
  });

  it("keeps only the allowed context fields", () => {
    const result = service.minimize({
      businessName: "Demo Store",
      businessDescription: "Retail",
      businessPolicies: "No refunds after 30 days",
      customerSummary: "Frequent buyer",
      allowedActions: ["DRAFT_REPLY"],
      recentMessages: [],
      rawPayload: { secret: true },
      internalId: "internal-1",
    } as any);

    expect(result).toEqual({
      businessName: "Demo Store",
      businessDescription: "Retail",
      businessPolicies: "No refunds after 30 days",
      customerSummary: "Frequent buyer",
      allowedActions: ["DRAFT_REPLY"],
      recentMessages: [],
    });
  });
});
