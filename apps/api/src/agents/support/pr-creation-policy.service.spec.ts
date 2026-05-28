import { PrCreationPolicyService, PrProposalInput } from "./pr-creation-policy.service";

describe("PrCreationPolicyService", () => {
  const svc = new PrCreationPolicyService();

  const baseInput = (overrides: Partial<PrProposalInput> = {}): PrProposalInput => ({
    tier: "TIER_4",
    base_branch: "master",
    branch_name: "fix/ai/auth/1717000000",
    files: [{ path: "apps/api/src/health/health.controller.ts", content: "export class X {}" }],
    securityReviewPassed: true,
    ...overrides,
  });

  it("allows a well-formed Tier 4 proposal and always forces draft + review labels", () => {
    const d = svc.validateProposal(baseInput());
    expect(d.allowed).toBe(true);
    expect(d.draft).toBe(true);
    expect(d.labels).toEqual(expect.arrayContaining(["ai-generated", "needs-human-review"]));
  });

  it("blocks Tier 1 and Tier 2 from creating PRs", () => {
    expect(svc.validateProposal(baseInput({ tier: "TIER_1" })).allowed).toBe(false);
    expect(svc.validateProposal(baseInput({ tier: "TIER_2" })).allowed).toBe(false);
  });

  it("blocks Tier 3 unless allow_pr_creation override is set", () => {
    expect(svc.validateProposal(baseInput({ tier: "TIER_3" })).allowed).toBe(false);
    expect(
      svc.validateProposal(baseInput({ tier: "TIER_3", allowPrOverride: true })).allowed,
    ).toBe(true);
  });

  it("rejects unsafe branch names", () => {
    const d = svc.validateProposal(baseInput({ branch_name: "master" }));
    expect(d.allowed).toBe(false);
    expect(d.violations.join(" ")).toMatch(/branch_name/);
  });

  it("blocks prohibited paths (.env, CI workflows, private keys)", () => {
    for (const path of [".env", "apps/api/.env.local", ".github/workflows/deploy.yml", "certs/server.key"]) {
      const d = svc.validateProposal(baseInput({ files: [{ path, content: "x" }] }));
      expect(d.allowed).toBe(false);
    }
  });

  it("blocks proposals containing embedded secrets", () => {
    const d = svc.validateProposal(
      baseInput({
        files: [{ path: "apps/api/src/x.ts", content: 'const k = "sk-ABCDEF0123456789ABCDEF";' }],
      }),
    );
    expect(d.allowed).toBe(false);
    expect(d.violations.join(" ")).toMatch(/secreto/);
  });

  it("blocks destructive migrations", () => {
    const d = svc.validateProposal(
      baseInput({
        files: [{ path: "apps/api/prisma/migrations/x/migration.sql", content: "DROP TABLE users;" }],
      }),
    );
    expect(d.allowed).toBe(false);
    expect(d.violations.join(" ")).toMatch(/destructiva/);
  });

  it("requires a passed security review when touching sensitive areas", () => {
    const sensitive = baseInput({
      files: [{ path: "apps/api/src/auth/auth.service.ts", content: "export class A {}" }],
      securityReviewPassed: false,
    });
    const d = svc.validateProposal(sensitive);
    expect(d.allowed).toBe(false);
    expect(d.labels).toContain("security-review-required");

    const passed = svc.validateProposal({ ...sensitive, securityReviewPassed: true });
    expect(passed.allowed).toBe(true);
    expect(passed.labels).toContain("security-review-required");
  });
});
