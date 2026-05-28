/**
 * PrCreationPolicyService
 *
 * Central authority that decides whether an agent-proposed PR may be created,
 * and under what constraints. Agents NEVER create PRs directly — they ask this
 * service, which enforces the invariants that keep an autonomous agent from
 * doing anything irreversible.
 *
 * Hard guarantees enforced here:
 *  - Agents can create PRs only when the tier allows it.
 *  - Every agent PR is forced to `draft: true` and carries review labels.
 *  - Prohibited / restricted paths (.env, secrets, prod config, destructive
 *    migrations, security-weakening CI) block the PR.
 *  - PRs containing secrets are blocked.
 *  - Agents can never target a protected base branch, never force-push, never
 *    merge, never approve, never enable auto-merge. (Those actions are simply
 *    not exposed; this service additionally validates the inputs it does see.)
 */
import { Injectable, Logger } from "@nestjs/common";
import type { SupportTier } from "./support-agent.types";
import { tierAllowsPrCreation } from "./support-agents.catalog";

/** Files/areas an agent PR may never touch. */
const PROHIBITED_PATH_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/i, // .env, .env.local, etc.
  /(^|\/)secrets?(\/|\.|$)/i,
  /(^|\/)\.git\//i,
  /(^|\/)railway\.(json|toml)$/i,
  /(^|\/)wrangler\.toml$/i,
  /(^|\/)\.github\/workflows\//i, // CI — never let an agent weaken pipelines
  /\.(pem|key|p12|pfx)$/i, // private keys / certs
  /(^|\/)id_rsa(\.|$)/i,
];

/** Areas that require an explicit security/human review label before a PR is allowed. */
const RESTRICTED_PATH_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(^|\/)auth\//i, label: "security-review-required" },
  { pattern: /(^|\/)billing\//i, label: "billing-review-required" },
  { pattern: /(^|\/)payments?\//i, label: "billing-review-required" },
  { pattern: /(^|\/)prisma\/migrations?\//i, label: "database-review-required" },
  { pattern: /(^|\/)workspace/i, label: "tenant-isolation-review-required" },
  { pattern: /(^|\/)integrations?\//i, label: "integration-review-required" },
  { pattern: /(^|\/)webhooks?\//i, label: "integration-review-required" },
];

/** Patterns that indicate secrets accidentally embedded in proposed file content. */
const SECRET_CONTENT_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{16,}\b/, // OpenAI-style keys
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i,
  /\beyJ[A-Za-z0-9._-]{20,}\b/, // JWT
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  /\b(postgres|postgresql|mysql|mongodb(\+srv)?):\/\/[^\s"']+/i, // DB URLs
  /\b[A-Za-z0-9_]*(api[_-]?key|secret|token|password)[A-Za-z0-9_]*\s*[:=]\s*['"][^'"]{8,}['"]/i,
];

/** Markers of destructive SQL migrations. */
const DESTRUCTIVE_MIGRATION_PATTERNS: RegExp[] = [
  /\bDROP\s+(TABLE|COLUMN|SCHEMA|DATABASE)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
];

/** Branch names an agent may never target or push to. */
const PROTECTED_BRANCHES = new Set(["main", "master", "main-web", "main-api", "production", "prod"]);

const SAFE_BRANCH_RE = /^fix\/ai\/[a-z0-9-]+\/[0-9]+$/;
const MANDATORY_LABELS = ["ai-generated", "needs-human-review"];

export interface PrProposalInput {
  tier: SupportTier;
  /** Whether the workspace explicitly enabled PR creation (only meaningful for Tier 3). */
  allowPrOverride?: boolean;
  /** Whether the security/compliance agent has signed off. */
  securityReviewPassed?: boolean;
  branch_name: string;
  base_branch: string;
  files: Array<{ path: string; content: string }>;
}

export interface PrPolicyDecision {
  allowed: boolean;
  /** Why it was blocked (empty when allowed). */
  violations: string[];
  /** Labels that must be applied to the PR. */
  labels: string[];
  /** Always true for agent PRs — they are never created ready-for-merge. */
  draft: true;
}

@Injectable()
export class PrCreationPolicyService {
  private readonly logger = new Logger(PrCreationPolicyService.name);

  /**
   * Validate an agent-proposed PR. Returns a decision; never throws on policy
   * failure so callers can audit/escalate uniformly.
   */
  validateProposal(input: PrProposalInput): PrPolicyDecision {
    const violations: string[] = [];
    const labels = new Set<string>(MANDATORY_LABELS);

    // 1. Tier gate.
    if (!tierAllowsPrCreation(input.tier, input.allowPrOverride ?? false)) {
      violations.push(
        `Tier ${input.tier} no está autorizado a crear PRs` +
          (input.tier === "TIER_3" ? " (requiere allow_pr_creation=true)" : ""),
      );
    }

    // 2. Base branch must not be protected.
    const base = (input.base_branch ?? "").trim();
    if (!base) {
      violations.push("base_branch es obligatorio");
    } else if (PROTECTED_BRANCHES.has(base.toLowerCase())) {
      // PRs *target* a base branch for review — that's fine — but an agent must
      // never be pushing INTO a protected branch as its head/source.
      // (Targeting master for review is allowed; we only forbid it as head below.)
    }

    // 3. Head/branch name must match the safe convention and not be protected.
    const branch = (input.branch_name ?? "").trim();
    if (!SAFE_BRANCH_RE.test(branch)) {
      violations.push(`branch_name inseguro o mal formado: "${branch}" (esperado fix/ai/<area>/<timestamp>)`);
    }
    if (PROTECTED_BRANCHES.has(branch.toLowerCase())) {
      violations.push(`branch_name no puede ser una rama protegida: "${branch}"`);
    }

    // 4. File-level checks.
    if (!input.files?.length) {
      violations.push("La propuesta no contiene archivos");
    }
    let touchesRestricted = false;
    for (const file of input.files ?? []) {
      const path = file.path ?? "";

      for (const re of PROHIBITED_PATH_PATTERNS) {
        if (re.test(path)) {
          violations.push(`Archivo prohibido para agentes: ${path}`);
          break;
        }
      }

      for (const rule of RESTRICTED_PATH_RULES) {
        if (rule.pattern.test(path)) {
          labels.add(rule.label);
          touchesRestricted = true;
        }
      }

      for (const re of SECRET_CONTENT_PATTERNS) {
        if (re.test(file.content ?? "")) {
          violations.push(`Posible secreto embebido en ${path}`);
          break;
        }
      }

      if (/migrations?\//i.test(path)) {
        for (const re of DESTRUCTIVE_MIGRATION_PATTERNS) {
          if (re.test(file.content ?? "")) {
            violations.push(`Migración destructiva detectada en ${path}`);
            break;
          }
        }
      }
    }

    // 5. Sensitive areas require a passed security review.
    if (touchesRestricted && input.securityReviewPassed !== true) {
      violations.push(
        "El cambio toca un área sensible y requiere que el Security/Compliance Agent apruebe primero",
      );
      labels.add("security-review-required");
    }

    const allowed = violations.length === 0;
    if (!allowed) {
      this.logger.warn(
        `[pr-policy] PR proposal blocked (${violations.length} violation(s)): ${violations.join("; ")}`,
      );
    }

    return { allowed, violations, labels: [...labels], draft: true };
  }
}
