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
    role: "Routes a case to the right specialized agent.",
    tierAccess: ALL_TIERS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data", "get_recent_errors"],
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
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: INTAKE_TRIAGE_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "customer-support",
    name: "Customer Support Agent",
    role: "Helps users with product usage and configuration.",
    tierAccess: ALL_TIERS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data"],
    systemPrompt: CUSTOMER_SUPPORT_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "channel-integration",
    name: "Channel Integration Agent",
    role: "Diagnoses WhatsApp / Telegram / email connection issues using real channel data.",
    tierAccess: TIER_2_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: [
      "get_workspace_data",
      "get_channel_status",
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
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: CRM_WORKFLOW_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "billing-subscription",
    name: "Billing / Subscription Agent",
    role: "Explains plans, limits and subscription state using real billing data.",
    tierAccess: TIER_2_PLUS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data", "get_billing_status"],
    systemPrompt: BILLING_SUBSCRIPTION_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: true,
  },
  {
    slug: "technical-diagnostic",
    name: "Technical Diagnostic Agent",
    role: "Reads logs, real code, and commits to find root cause with evidence.",
    tierAccess: TIER_2_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: [
      "get_workspace_data",        // Custom Tool → PymesHub API
      "get_recent_errors",         // Custom Tool → PymesHub API
      "get_railway_logs",          // Custom Tool → Railway GraphQL
      "read_github_file",          // Custom Tool → GitHub API
      "search_github_code",        // Custom Tool → GitHub Search API
      "get_recent_commits",        // Custom Tool → GitHub Commits API
    ],
    systemPrompt: TECHNICAL_DIAGNOSTIC_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "code-fix-proposal",
    name: "Code Fix Proposal Agent",
    role: "Reads real code and produces complete, reviewable file fixes.",
    tierAccess: TIER_3_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: [
      "get_workspace_data",
      "read_github_file",          // Custom Tool → GitHub API
      "search_github_code",        // Custom Tool → GitHub Search API
      "get_recent_commits",         // Custom Tool → GitHub Commits API
      "create_github_pr",          // Custom Tool → GitHub API (draft PR)
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
    tools: ["read_github_file", "get_recent_commits"],
    systemPrompt: PR_REVIEW_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "security-compliance",
    name: "Security / Compliance Agent",
    role: "Mandatory gate before any PR touching sensitive areas.",
    tierAccess: TIER_3_PLUS,
    model: "reasoning",
    temperature: 0.0,
    tools: ["read_github_file"],
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
    tools: ["get_workspace_data"],
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
