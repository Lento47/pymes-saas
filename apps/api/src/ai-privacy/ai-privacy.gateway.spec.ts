import { ForbiddenException } from "@nestjs/common";
import { AiAuditLogService } from "./ai-audit-log.service";
import { AiContextMinimizerService } from "./ai-context-minimizer.service";
import { AiOutputGuardService } from "./ai-output-guard.service";
import { AiPrivacyGateway } from "./ai-privacy.gateway";
import { PiiRedactorService } from "./pii-redactor.service";

describe("AiPrivacyGateway", () => {
  const auditLog = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AiAuditLogService;

  const gateway = new AiPrivacyGateway(
    new AiContextMinimizerService(),
    new PiiRedactorService(),
    auditLog,
    new AiOutputGuardService(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects missing workspaceId", async () => {
    await expect(
      gateway.generateResponse({
        workspaceId: "",
        purpose: "CUSTOMER_SUPPORT",
        userMessage: "Hola",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("records audit metadata without raw prompt, message, response, or full context", async () => {
    await gateway.generateResponse({
      workspaceId: "ws_1",
      customerId: "cus_1",
      conversationId: "conv_1",
      purpose: "CUSTOMER_SUPPORT",
      userMessage: "Mi correo es ana@example.com",
      context: {
        businessName: "Demo Store",
        recentMessages: [{ role: "customer", content: "Mi correo es ana@example.com" }],
      },
    });

    expect(auditLog.record).toHaveBeenCalledTimes(1);
    const auditPayload = (auditLog.record as jest.Mock).mock.calls[0][0];

    expect(auditPayload).toMatchObject({
      workspaceId: "ws_1",
      customerId: "cus_1",
      conversationId: "conv_1",
      purpose: "CUSTOMER_SUPPORT",
    });
    expect(auditPayload.piiDetected).toContain("EMAIL");
    expect(JSON.stringify(auditPayload)).not.toContain("ana@example.com");
    expect(JSON.stringify(auditPayload)).not.toContain("Demo Store");
  });
});
