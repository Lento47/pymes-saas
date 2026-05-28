/**
 * Support multi-agent architecture — type definitions.
 *
 * PR1 scope: these types describe the agent catalog, the tier access matrix,
 * and the structured output contracts. They are the design surface that the
 * runtime (PR2) will enforce. Nothing here grants an agent permission to merge,
 * approve, deploy, or mutate production — those are explicitly out of scope.
 */

/** Support tiers, aligned with the existing SUPPORT_TIER_SLUGS keys. */
export type SupportTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";

export const SUPPORT_TIERS: SupportTier[] = ["TIER_1", "TIER_2", "TIER_3", "TIER_4"];

/**
 * Semantic model class. We deliberately do NOT hardcode the concrete DeepSeek
 * model id in the catalog — a previous incident was caused by an unregistered
 * model name (`deepseek-chat`). The concrete id is resolved once, centrally.
 *
 *  - "fast"      → quick, cheaper model for support/triage/customer-facing work
 *  - "reasoning" → slower, stronger model for diagnosis / code / security review
 */
export type SupportAgentModel = "fast" | "reasoning";

/** Resolve a semantic model class to the concrete Flowise/DeepSeek model id. */
export const SUPPORT_MODEL_NAME: Record<SupportAgentModel, string> = {
  fast: "deepseek-v4-flash",
  reasoning: "deepseek-v4-pro",
};

/** Stable identifiers for every specialized support agent. */
export type SupportAgentSlug =
  | "support-orchestrator"
  | "intake-triage"
  | "customer-support"
  | "channel-integration"
  | "crm-workflow"
  | "billing-subscription"
  | "technical-diagnostic"
  | "code-fix-proposal"
  | "pr-review"
  | "security-compliance"
  | "human-handoff";

/**
 * A single specialized agent definition. This is the unit the orchestrator
 * delegates to and the unit that FlowiseSetupService will provision (PR2).
 */
export interface SupportAgentDefinition {
  /** Stable, unique identifier. */
  slug: SupportAgentSlug;
  /** Human-readable name (shown in Flowise / internal tooling). */
  name: string;
  /** One-line role description. */
  role: string;
  /** Which tiers may invoke this agent. */
  tierAccess: SupportTier[];
  /** Semantic model class — resolved via SUPPORT_MODEL_NAME. */
  model: SupportAgentModel;
  /** Sampling temperature. Lower = more deterministic. */
  temperature: number;
  /** Names of tools this agent is allowed to call (schemas defined separately). */
  tools: string[];
  /** Full system prompt. Stored in a separate prompts module, not inline. */
  systemPrompt: string;
  /**
   * Whether this agent is *capable* of requesting a PR creation. This is a
   * capability flag only — the PrCreationPolicyService still has the final say,
   * and the workspace plan + `allow_pr_creation` must also permit it.
   */
  canCreatePr: boolean;
  /** Whether a security/compliance pass is mandatory before this agent acts on sensitive areas. */
  requiresSecurityReview: boolean;
  /** Whether this agent's output always requires explicit human approval to take effect. */
  requiresHumanApproval: boolean;
}

// ── Structured output contracts ──────────────────────────────────────────────

export type SupportCaseType =
  | "bug"
  | "configuration"
  | "provider_issue"
  | "user_error"
  | "billing"
  | "security"
  | "unknown";

export type SupportSeverity = "low" | "medium" | "high" | "critical";
export type SupportRisk = "low" | "medium" | "high";

/** Output contract for the Technical Diagnostic / Triage agents. */
export interface DiagnosticOutput {
  case_type: SupportCaseType;
  severity: SupportSeverity;
  summary: string;
  evidence: string[];
  likely_root_cause: string;
  recommended_next_step: string;
  needs_human_review: boolean;
  allowed_to_create_pr: boolean;
}

/** A single proposed file change. `content_complete` is the full file, never a diff. */
export interface FixFileChange {
  path: string;
  reason: string;
  risk: SupportRisk;
  content_complete: string;
}

/** Output contract for the Code Fix Proposal agent. */
export interface FixProposalOutput {
  root_cause: string;
  fix_summary: string;
  files_to_change: FixFileChange[];
  tests_to_run: string[];
  rollback_plan: string;
  requires_human_approval: boolean;
}

/** Output contract for any PR-creating agent. PRs are always draft + review-gated. */
export interface PrProposalOutput {
  branch_name: string;
  pr_title: string;
  pr_body: string;
  labels: string[];
  draft: boolean;
}
