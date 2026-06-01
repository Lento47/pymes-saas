/**
 * Support OS — type definitions for the agent council architecture.
 *
 * Multi-agent support system with:
 *  - Dynamic agent groups (not monolithic tiers)
 *  - Structured output protocol with confidence scores
 *  - Plan-based profile policies (not tier-based gating)
 *  - Consensus / arbiter protocol for multi-agent agreement
 */

/** Support tiers — retained for backward compat; prefer profiles. */
export type SupportTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
export const SUPPORT_TIERS: SupportTier[] = ["TIER_1", "TIER_2", "TIER_3", "TIER_4"];

/**
 * Support profiles map plans to capability depth.
 * Every plan uses the full Support OS — depth differs, not quality.
 */
export type SupportProfile =
  | "FREE_GUIDED"
  | "EMPRENDE_OPERATIONS"
  | "STARTER_OPERATIONS"
  | "GROWTH_DIAGNOSTIC"
  | "BUSINESS_ADVANCED"
  | "BUSINESS_PLUS_ENGINEERING"
  | "ENTERPRISE_CUSTOM";

/** Plan → Support Profile mapping. No plan gets a "dumb bot". */
export const PLAN_TO_SUPPORT_PROFILE: Record<string, SupportProfile> = {
  FREE: "FREE_GUIDED",
  BETA_INFORMAL: "FREE_GUIDED",
  EMPRENDE: "EMPRENDE_OPERATIONS",
  STARTER: "STARTER_OPERATIONS",
  GROWTH: "GROWTH_DIAGNOSTIC",
  BUSINESS: "BUSINESS_ADVANCED",
  BUSINESS_PLUS: "BUSINESS_PLUS_ENGINEERING",
  ENTERPRISE: "ENTERPRISE_CUSTOM",
};

/** Per-profile capability policy. Depth of access, not binary gating. */
export interface SupportProfilePolicy {
  profile: SupportProfile;
  allowedAgents: string[]; // agent slugs this profile can use
  allowedTools: string[];
  maxAgentRunsPerDay: number | "unlimited";
  maxContextMessages: number;
  canReadLogs: boolean;
  canReadCode: boolean;
  canCreateFixProposal: boolean;
  canCreatePrDraft: boolean;
  requiresHumanApprovalFor: string[]; // agent slugs that always need human sign-off
}

/**
 * Semantic model class. Resolved centrally to avoid unregistered model names.
 *  - "fast"      → quick, cheaper model for support/triage/customer-facing work
 *  - "reasoning" → slower, stronger model for diagnosis / code / security review
 */
export type SupportAgentModel = "fast" | "reasoning";

/** Resolve a semantic model class to the concrete model id. */
export const SUPPORT_MODEL_NAME: Record<SupportAgentModel, string> = {
  fast: "deepseek-v4-flash",
  reasoning: "deepseek-v4-pro",
};

/**
 * Stable identifiers for every specialized support agent.
 * 25 agents covering all PymesHub domains.
 */
export type SupportAgentSlug =
  // ── Council / Orchestration ──
  | "support-supervisor"
  | "intake-triage"
  | "feature-router"
  | "evidence-collector"
  | "consensus-arbiter"
  | "user-communication"
  | "human-handoff"
  // ── Domain Specialists ──
  | "workspace-permissions"
  | "inbox-conversation"
  | "channel-integration"
  | "provider-events"
  | "crm-contacts"
  | "tasks-agent"
  | "sales-pipeline"
  | "products-catalog"
  | "workflow-automation"
  | "billing-subscription"
  | "hacienda-invoicing"
  | "documents-storage"
  | "technical-diagnostic"
  | "ai-behavior"
  | "ai-privacy-safety"
  | "prompt-injection-review"
  | "security-compliance"
  | "code-fix-proposal"
  | "pr-review";

/** PymesHub feature domains — used for dynamic agent group routing. */
export type SupportFeature =
  | "CHANNEL_DELIVERY_ISSUE"
  | "HACIENDA_REJECTION"
  | "AI_AGENT_BAD_RESPONSE"
  | "WORKFLOW_NOT_RUNNING"
  | "BILLING_ISSUE"
  | "SECURITY_CONCERN"
  | "UI_BUG"
  | "API_ERROR"
  | "PERFORMANCE_DEGRADATION"
  | "DATA_INTEGRITY"
  | "GENERAL_INQUIRY";

/** A single specialized agent definition. */
export interface SupportAgentDefinition {
  slug: SupportAgentSlug;
  name: string;
  role: string;
  tierAccess: SupportTier[]; // backward compat
  profileAccess: SupportProfile[]; // new — which profiles can use this agent
  model: SupportAgentModel;
  temperature: number;
  tools: string[];
  systemPrompt: string;
  canCreatePr: boolean;
  requiresSecurityReview: boolean;
  requiresHumanApproval: boolean;
}

// ── Structured Output Contracts ──────────────────────────────────────────────

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

/** A single finding from a specialist agent, with evidence and confidence. */
export interface AgentFinding {
  type: "evidence" | "observation" | "warning" | "error";
  description: string;
  source: string; // tool or method that produced this finding
  entity_id?: string;
  confidence: number; // 0.0 – 1.0
}

/** Output contract for every specialist agent in the council. */
export interface DiagnosticOutput {
  agent?: SupportAgentSlug;
  case_type: SupportCaseType;
  severity: SupportSeverity;
  summary: string;
  evidence: string[];
  findings: AgentFinding[];
  suspected_root_cause: string;
  recommended_action: string;
  confidence: number; // 0.0 – 1.0
  needs_human_review: boolean;
  allowed_to_create_pr: boolean;
  risks: string[];
  requires_human_approval: boolean;
  /** When true, the agent needs more info from the user before proceeding. */
  clarification_needed?: boolean;
  /** Questions the agent wants to ask the user (only when clarification_needed). */
  questions?: string[];
}

/** Consensus / Arbiter output — synthesizes all agent findings. */
export interface ConsensusOutput {
  case_id: string;
  agent_findings: AgentFinding[];
  conflicts: Array<{
    agent_a: SupportAgentSlug;
    agent_b: SupportAgentSlug;
    topic: string;
    resolution: string;
  }>;
  final_root_cause: string;
  final_recommendation: string;
  user_visible_summary: string;
  internal_notes: string;
  next_action: "reply_to_user" | "ask_clarification" | "create_fix_proposal" | "escalate_human";
}

/** Dynamic agent group — assembled by the feature router per case. */
export interface SupportAgentGroup {
  caseId: string;
  feature: SupportFeature;
  severity: SupportSeverity;
  agents: SupportAgentSlug[];
  requiredTools: string[];
  requiresHumanApproval: boolean;
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
