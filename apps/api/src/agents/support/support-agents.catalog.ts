/**
 * Support multi-agent catalog.
 *
 * Single source of truth for which specialized agents exist, which tiers may
 * use them, which tools they may call, and which guardrail flags apply.
 *
 * PR1 scope: this is declarative metadata + helpers. It does not by itself
 * provision Flowise flows or grant runtime permissions — FlowiseSetupService
 * and the runtime (PR2) consume this catalog and still defer to
 * PrCreationPolicyService and plan checks for any privileged action.
 */
import type {
  SupportAgentDefinition,
  SupportAgentSlug,
  SupportTier,
} from "./support-agent.types";
import {
  BILLING_SUBSCRIPTION_PROMPT,
  CHANNEL_INTEGRATION_PROMPT,
  CODE_FIX_PROPOSAL_PROMPT,
  CRM_WORKFLOW_PROMPT,
  CUSTOMER_SUPPORT_PROMPT,
  HUMAN_HANDOFF_PROMPT,
  INTAKE_TRIAGE_PROMPT,
  PR_REVIEW_PROMPT,
  SECURITY_COMPLIANCE_PROMPT,
  SUPPORT_ORCHESTRATOR_PROMPT,
  TECHNICAL_DIAGNOSTIC_PROMPT,
} from "./support-agent.prompts";

const ALL_TIERS: SupportTier[] = ["TIER_1", "TIER_2", "TIER_3", "TIER_4"];
const TIER_2_PLUS: SupportTier[] = ["TIER_2", "TIER_3", "TIER_4"];
const TIER_3_PLUS: SupportTier[] = ["TIER_3", "TIER_4"];

export const SUPPORT_AGENTS: SupportAgentDefinition[] = [
  {
    slug: "support-orchestrator",
    name: "Support Orchestrator",
    role: "Routes a case to the right specialized agent; never resolves it alone.",
    tierAccess: ALL_TIERS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_context", "get_workspace_plan", "list_diagnostic_cases"],
    systemPrompt: SUPPORT_ORCHESTRATOR_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "intake-triage",
    name: "Intake / Triage Agent",
    role: "Turns a fuzzy report into a structured, classified case.",
    tierAccess: ALL_TIERS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_context", "get_recent_errors", "add_internal_case_note"],
    systemPrompt: INTAKE_TRIAGE_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "customer-support",
    name: "Customer Support Agent",
    role: "Helps users with normal product usage and configuration.",
    tierAccess: ALL_TIERS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_context", "get_conversation_context"],
    systemPrompt: CUSTOMER_SUPPORT_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "channel-integration",
    name: "Channel Integration Agent",
    role: "Diagnoses WhatsApp / Telegram / email connection and webhook issues.",
    tierAccess: TIER_2_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: [
      "get_workspace_context",
      "get_channel_status",
      "get_whatsapp_status",
      "get_telegram_status",
      "get_recent_errors",
    ],
    systemPrompt: CHANNEL_INTEGRATION_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "crm-workflow",
    name: "CRM / Workflow Agent",
    role: "Helps with contacts, conversations, tasks, pipelines and automations.",
    tierAccess: TIER_2_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_context", "get_workflow_config", "get_conversation_context"],
    systemPrompt: CRM_WORKFLOW_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "billing-subscription",
    name: "Billing / Subscription Agent",
    role: "Explains plans, limits and subscription state; never mutates billing.",
    tierAccess: TIER_2_PLUS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_context", "get_workspace_plan", "get_billing_status"],
    systemPrompt: BILLING_SUBSCRIPTION_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: true,
  },
  {
    slug: "technical-diagnostic",
    name: "Technical Diagnostic Agent",
    role: "Reads logs and real code to find probable root cause with evidence.",
    // Tier 2 gets a limited/redacted variant (enforced by tool access at runtime, PR2).
    tierAccess: TIER_2_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: [
      "get_workspace_context",
      "get_recent_errors",
      "get_railway_logs",
      "read_github_file",
      "search_github_files",
      "get_recent_commits",
      "list_diagnostic_cases",
    ],
    systemPrompt: TECHNICAL_DIAGNOSTIC_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "code-fix-proposal",
    name: "Code Fix Proposal Agent",
    role: "Turns a verified diagnosis into a complete, reviewable change proposal.",
    tierAccess: TIER_3_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: [
      "get_workspace_context",
      "read_github_file",
      "search_github_files",
      "get_recent_commits",
      "create_fix_proposal",
      // create_github_pr is listed but gated by plan + PrCreationPolicyService (PR2).
      "create_github_pr",
    ],
    systemPrompt: CODE_FIX_PROPOSAL_PROMPT,
    canCreatePr: true,
    requiresSecurityReview: true,
    requiresHumanApproval: true,
  },
  {
    slug: "pr-review",
    name: "PR Review Agent",
    role: "Reviews agent-generated PRs for a human; never approves or merges.",
    tierAccess: TIER_3_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: ["get_workspace_context", "read_github_file", "get_recent_commits"],
    systemPrompt: PR_REVIEW_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "security-compliance",
    name: "Security / Compliance Agent",
    role: "Mandatory gate before any PR touching sensitive areas; can block.",
    tierAccess: TIER_3_PLUS,
    model: "reasoning",
    temperature: 0.0,
    tools: ["get_workspace_context", "read_github_file"],
    systemPrompt: SECURITY_COMPLIANCE_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "human-handoff",
    name: "Human Handoff Agent",
    role: "Prepares a structured summary for the founder/admin to act on.",
    tierAccess: ALL_TIERS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_context", "add_internal_case_note"],
    systemPrompt: HUMAN_HANDOFF_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: true,
  },
];

// ── Lookups ──────────────────────────────────────────────────────────────────

const BY_SLUG = new Map<SupportAgentSlug, SupportAgentDefinition>(
  SUPPORT_AGENTS.map((a) => [a.slug, a]),
);

export function getSupportAgent(slug: SupportAgentSlug): SupportAgentDefinition | undefined {
  return BY_SLUG.get(slug);
}

/** All agents a given tier is allowed to use. */
export function getAgentsForTier(tier: SupportTier): SupportAgentDefinition[] {
  return SUPPORT_AGENTS.filter((a) => a.tierAccess.includes(tier));
}

/** Whether a tier may use a specific agent. */
export function tierCanUseAgent(tier: SupportTier, slug: SupportAgentSlug): boolean {
  return getSupportAgent(slug)?.tierAccess.includes(tier) ?? false;
}

/**
 * Whether a tier is *structurally* allowed to create PRs at all.
 * This is the coarse gate; PrCreationPolicyService applies the fine-grained one.
 * Tier 4 may create PRs; Tier 3 only when `allow_pr_creation` is explicitly set.
 */
export function tierAllowsPrCreation(tier: SupportTier, allowPrOverride = false): boolean {
  if (tier === "TIER_4") return true;
  if (tier === "TIER_3") return allowPrOverride === true;
  return false;
}
