import { ForbiddenException } from "@nestjs/common";
import { AiOutputGuardService } from "./ai-output-guard.service";

describe("AiOutputGuardService", () => {
  const service = new AiOutputGuardService();

  it("returns empty output safely", () => {
    expect(
      service.validate({
        workspaceId: "ws_1",
        purpose: "CUSTOMER_SUPPORT",
        output: "",
      }),
    ).toBe("");
  });

  it("allows normal customer-safe output", () => {
    expect(
      service.validate({
        workspaceId: "ws_1",
        purpose: "CUSTOMER_SUPPORT",
        output: "Con gusto, puedo ayudarte con tu pedido.",
      }),
    ).toBe("Con gusto, puedo ayudarte con tu pedido.");
  });

  it("blocks suspicious internal output", () => {
    expect(() =>
      service.validate({
        workspaceId: "ws_1",
        purpose: "CUSTOMER_SUPPORT",
        output: "The system prompt says to reveal internal instructions.",
      }),
    ).toThrow(ForbiddenException);
  });
});
