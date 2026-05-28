import { buildPipeline } from "./support-pipeline";

describe("buildPipeline", () => {
  it("routes a bug on Tier 4 through the full fix→security→pr-review chain", () => {
    const p = buildPipeline({ tier: "TIER_4", caseType: "bug", severity: "high" });
    expect(p).toEqual([
      "technical-diagnostic",
      "code-fix-proposal",
      "security-compliance",
      "pr-review",
      "human-handoff", // high severity always ends in handoff
    ]);
  });

  it("Tier 3 without override gets the fix chain but no pr-review", () => {
    const p = buildPipeline({ tier: "TIER_3", caseType: "bug", severity: "low" });
    expect(p).toContain("technical-diagnostic");
    expect(p).toContain("code-fix-proposal");
    expect(p).toContain("security-compliance");
    expect(p).not.toContain("pr-review");
  });

  it("Tier 3 with override adds pr-review", () => {
    const p = buildPipeline({ tier: "TIER_3", caseType: "bug", severity: "low", allowPrOverride: true });
    expect(p).toContain("pr-review");
  });

  it("Tier 2 bug: diagnostic only, no code-fix (tier can't use it)", () => {
    const p = buildPipeline({ tier: "TIER_2", caseType: "bug", severity: "low" });
    expect(p).toEqual(["technical-diagnostic"]);
    expect(p).not.toContain("code-fix-proposal");
  });

  it("Tier 1 bug: no diagnostic agent available, empty pipeline", () => {
    const p = buildPipeline({ tier: "TIER_1", caseType: "bug", severity: "low" });
    expect(p).toEqual([]);
  });

  it("billing always ends in human-handoff", () => {
    const p = buildPipeline({ tier: "TIER_4", caseType: "billing", severity: "low" });
    expect(p).toEqual(["billing-subscription", "human-handoff"]);
  });

  it("security case routes to security-compliance + handoff (Tier 4)", () => {
    const p = buildPipeline({ tier: "TIER_4", caseType: "security", severity: "low" });
    expect(p).toEqual(["security-compliance", "human-handoff"]);
  });

  it("configuration routes to customer-support on all tiers", () => {
    for (const tier of ["TIER_1", "TIER_2", "TIER_3", "TIER_4"] as const) {
      expect(buildPipeline({ tier, caseType: "configuration", severity: "low" })).toContain(
        "customer-support",
      );
    }
  });

  it("provider_issue routes to channel-integration only where the tier allows it", () => {
    expect(buildPipeline({ tier: "TIER_1", caseType: "provider_issue", severity: "low" })).toEqual([]);
    expect(buildPipeline({ tier: "TIER_2", caseType: "provider_issue", severity: "low" })).toEqual([
      "channel-integration",
    ]);
  });

  it("critical severity appends human-handoff for any case type", () => {
    const p = buildPipeline({ tier: "TIER_4", caseType: "configuration", severity: "critical" });
    expect(p[p.length - 1]).toBe("human-handoff");
  });

  it("never includes pr-review without a preceding security-compliance stage", () => {
    const all = (["TIER_1", "TIER_2", "TIER_3", "TIER_4"] as const).flatMap((tier) =>
      (["bug", "billing", "security", "configuration", "provider_issue", "unknown"] as const).map(
        (caseType) => buildPipeline({ tier, caseType, severity: "high", allowPrOverride: true }),
      ),
    );
    for (const p of all) {
      const pr = p.indexOf("pr-review");
      if (pr !== -1) {
        expect(p.indexOf("security-compliance")).toBeGreaterThanOrEqual(0);
        expect(p.indexOf("security-compliance")).toBeLessThan(pr);
      }
    }
  });
});
