import { EmprendePlaybooksService } from "./emprende-playbooks.service";

describe("EmprendePlaybooksService", () => {
  function makeService() {
    return new EmprendePlaybooksService();
  }

  it("classifies payment_reported and always requires escalation", () => {
    const service = makeService();

    const output = service.run({
      businessName: "Demo Biz",
      message: "Ya pagué por SINPE, te paso comprobante",
      planKey: "EMPRENDE",
    });

    expect(output.intent).toBe("payment_reported");
    expect(output.escalationRequired).toBe(true);
    expect(output.forbiddenActions).toContain("confirm_payment_without_verification");
  });

  it("returns ADVANCED tier capabilities for BUSINESS plans", () => {
    const service = makeService();

    const output = service.run({
      businessName: "Demo Biz",
      message: "Necesito una cotización para esta semana",
      planKey: "BUSINESS",
    });

    expect(output.intent).toBe("sales_quote");
    expect(output.capabilityTier).toBe("ADVANCED");
    expect(output.requiredFields).toEqual(
      expect.arrayContaining(["need", "target_date", "zone_or_budget", "lead_source"]),
    );
    expect(output.allowedActions).toEqual(expect.arrayContaining(["priority_tagging"]));
  });

  it("redirects off-topic messages to business scope", () => {
    const service = makeService();

    const output = service.run({
      businessName: "Tienda CR",
      message: "¿Quién ganó el partido ayer?",
      planKey: "FREE",
    });

    expect(output.intent).toBe("off_topic");
    expect(output.reply).toBe("");
    expect(output.escalationRequired).toBe(false);
  });
});
