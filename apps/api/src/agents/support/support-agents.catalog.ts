/**
 * Support OS — agent council catalog.
 *
 * Single source of truth for all 25 specialized agents, their capabilities,
 * tier/profile access, tools, and guardrail flags.
 *
 * Council agents (6): supervisor, intake, router, collector, arbiter, communication
 * Domain specialists (19): one per PymesHub domain
 */

import type {
  SupportAgentDefinition,
  SupportAgentSlug,
  SupportFeature,
  SupportProfile,
  SupportProfilePolicy,
  SupportTier,
} from "./support-agent.types";
import { PLAN_TO_SUPPORT_PROFILE } from "./support-agent.types";
import {
  // ── Original prompts (kept) ──
  INTAKE_TRIAGE_PROMPT,
  CHANNEL_INTEGRATION_PROMPT,
  BILLING_SUBSCRIPTION_PROMPT,
  TECHNICAL_DIAGNOSTIC_PROMPT,
  CODE_FIX_PROPOSAL_PROMPT,
  PR_REVIEW_PROMPT,
  SECURITY_COMPLIANCE_PROMPT,
  HUMAN_HANDOFF_PROMPT,
  // ── Updated prompt ──
  SUPPORT_ORCHESTRATOR_PROMPT,
  // ── New council prompts ──
  SUPPORT_SUPERVISOR_PROMPT,
  FEATURE_ROUTER_PROMPT,
  EVIDENCE_COLLECTOR_PROMPT,
  CONSENSUS_ARBITER_PROMPT,
  USER_COMMUNICATION_PROMPT,
  // ── New domain specialist prompts ──
  WORKSPACE_PERMISSIONS_PROMPT,
  INBOX_CONVERSATION_PROMPT,
  PROVIDER_EVENTS_PROMPT,
  HACIENDA_INVOICING_PROMPT,
  DOCUMENTS_STORAGE_PROMPT,
  AI_BEHAVIOR_PROMPT,
  AI_PRIVACY_SAFETY_PROMPT,
  PROMPT_INJECTION_REVIEW_PROMPT,
  TASKS_AGENT_PROMPT,
  SALES_PIPELINE_PROMPT,
  PRODUCTS_CATALOG_PROMPT,
  WORKFLOW_AUTOMATION_PROMPT,
} from "./support-agent.prompts";

// ── Tier aliases (backward compat) ──────────────────────────────────────────
const ALL_TIERS: SupportTier[] = ["TIER_1", "TIER_2", "TIER_3", "TIER_4"];
const TIER_2_PLUS: SupportTier[] = ["TIER_2", "TIER_3", "TIER_4"];
const TIER_3_PLUS: SupportTier[] = ["TIER_3", "TIER_4"];

// ── Profile aliases ─────────────────────────────────────────────────────────
const ALL_PROFILES: SupportProfile[] = [
  "FREE_GUIDED", "EMPRENDE_OPERATIONS", "STARTER_OPERATIONS",
  "GROWTH_DIAGNOSTIC", "BUSINESS_ADVANCED", "BUSINESS_PLUS_ENGINEERING",
  "ENTERPRISE_CUSTOM",
];
const EMPRENDE_PLUS: SupportProfile[] = [
  "EMPRENDE_OPERATIONS", "STARTER_OPERATIONS", "GROWTH_DIAGNOSTIC",
  "BUSINESS_ADVANCED", "BUSINESS_PLUS_ENGINEERING", "ENTERPRISE_CUSTOM",
];
const DIAGNOSTIC_PLUS: SupportProfile[] = [
  "GROWTH_DIAGNOSTIC", "BUSINESS_ADVANCED", "BUSINESS_PLUS_ENGINEERING",
  "ENTERPRISE_CUSTOM",
];
const ENGINEERING_PLUS: SupportProfile[] = [
  "BUSINESS_PLUS_ENGINEERING", "ENTERPRISE_CUSTOM",
];

export const SUPPORT_AGENTS: SupportAgentDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COUNCIL AGENTS (6) — orchestration, routing, evidence, consensus
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: "support-supervisor",
    name: "Support Supervisor",
    role: "Coordinates the agent council, ensures complete and rigorous diagnosis.",
    tierAccess: ALL_TIERS,
    profileAccess: ALL_PROFILES,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: SUPPORT_SUPERVISOR_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "intake-triage",
    name: "Intake / Triage Agent",
    role: "Turns a fuzzy report into a structured, classified case.",
    tierAccess: ALL_TIERS,
    profileAccess: ALL_PROFILES,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: INTAKE_TRIAGE_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "feature-router",
    name: "Feature Router Agent",
    role: "Classifies the case into a feature domain and assembles the agent group.",
    tierAccess: ALL_TIERS,
    profileAccess: ALL_PROFILES,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data"],
    systemPrompt: FEATURE_ROUTER_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "evidence-collector",
    name: "Evidence Collector Agent",
    role: "Gathers logs, errors, code files, and commits as structured findings.",
    tierAccess: ALL_TIERS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.1,
    tools: [
      "get_workspace_data",
      "get_recent_errors",
      "get_railway_logs",
      "read_github_file",
      "get_recent_commits",
    ],
    systemPrompt: EVIDENCE_COLLECTOR_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "consensus-arbiter",
    name: "Consensus / Arbiter Agent",
    role: "Synthesizes findings from multiple specialists into a unified conclusion.",
    tierAccess: ALL_TIERS,
    profileAccess: EMPRENDE_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: ["get_workspace_data"],
    systemPrompt: CONSENSUS_ARBITER_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "user-communication",
    name: "User Communication Agent",
    role: "Translates technical diagnoses into clear Spanish responses for the user.",
    tierAccess: ALL_TIERS,
    profileAccess: ALL_PROFILES,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data"],
    systemPrompt: USER_COMMUNICATION_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "human-handoff",
    name: "Human Handoff Agent",
    role: "Prepares a structured summary for the founder/admin to act on.",
    tierAccess: ALL_TIERS,
    profileAccess: ALL_PROFILES,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data"],
    systemPrompt: HUMAN_HANDOFF_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN SPECIALISTS (18) — one per PymesHub domain
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: "workspace-permissions",
    name: "Workspace / Permissions Agent",
    role: "Diagnoses access, roles, permissions, and workspace configuration issues.",
    tierAccess: ALL_TIERS,
    profileAccess: ALL_PROFILES,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data"],
    systemPrompt: WORKSPACE_PERMISSIONS_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "inbox-conversation",
    name: "Inbox / Conversation Agent",
    role: "Diagnoses messaging, WebSocket, conversation state, and sync issues.",
    tierAccess: ALL_TIERS,
    profileAccess: ALL_PROFILES,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: INBOX_CONVERSATION_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "channel-integration",
    name: "Channel Integration Agent",
    role: "Diagnoses WhatsApp / Telegram / email connection issues using real channel data.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data", "get_channel_status", "get_recent_errors"],
    systemPrompt: CHANNEL_INTEGRATION_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "provider-events",
    name: "Provider Events Agent",
    role: "Diagnoses external provider webhooks, signatures, payloads, and delivery.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data", "get_recent_errors", "get_channel_status"],
    systemPrompt: PROVIDER_EVENTS_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "crm-contacts",
    name: "CRM / Contacts Agent",
    role: "Diagnoses contacts, segmentation, and CRM data issues.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: TASKS_AGENT_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "tasks-agent",
    name: "Tasks Agent",
    role: "Diagnoses task creation, completion, assignment, and notification issues.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: TASKS_AGENT_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "sales-pipeline",
    name: "Sales / Pipeline Agent",
    role: "Diagnoses deals, stages, pipeline movement, and pipeline rules.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: SALES_PIPELINE_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "products-catalog",
    name: "Products / Catalog Agent",
    role: "Diagnoses product, inventory, pricing, and catalog issues.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: PRODUCTS_CATALOG_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "workflow-automation",
    name: "Workflow / Automation Agent",
    role: "Diagnoses automation triggers, conditions, actions, and execution logs.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.3,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: WORKFLOW_AUTOMATION_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "billing-subscription",
    name: "Billing / Subscription Agent",
    role: "Explains plans, limits and subscription state using real billing data.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data", "get_billing_status"],
    systemPrompt: BILLING_SUBSCRIPTION_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: true,
  },
  {
    slug: "hacienda-invoicing",
    name: "Hacienda / Invoicing Agent",
    role: "Diagnoses electronic invoicing rejections, validation errors, and fiscal issues.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.1,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: HACIENDA_INVOICING_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: true,
  },
  {
    slug: "documents-storage",
    name: "Documents / Storage Agent",
    role: "Diagnoses document upload, download, access, and storage issues.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: DOCUMENTS_STORAGE_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "technical-diagnostic",
    name: "Technical Diagnostic Agent",
    role: "Reads logs, real code, and commits to find root cause with evidence.",
    tierAccess: TIER_2_PLUS,
    profileAccess: DIAGNOSTIC_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: [
      "get_workspace_data",
      "get_recent_errors",
      "get_railway_logs",
      "read_github_file",
      "search_github_code",
      "get_recent_commits",
    ],
    systemPrompt: TECHNICAL_DIAGNOSTIC_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "ai-behavior",
    name: "AI Behavior Agent",
    role: "Diagnoses incorrect AI responses, hallucinations, and unexpected agent behavior.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.2,
    tools: ["get_workspace_data", "get_recent_errors"],
    systemPrompt: AI_BEHAVIOR_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "ai-privacy-safety",
    name: "AI Privacy / Safety Agent",
    role: "Reviews AI agent outputs for PII leaks, data exposure, and privacy violations.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.0,
    tools: ["get_workspace_data"],
    systemPrompt: AI_PRIVACY_SAFETY_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "prompt-injection-review",
    name: "Prompt Injection Review Agent",
    role: "Detects prompt injection, jailbreak, and social engineering attempts in user messages.",
    tierAccess: TIER_2_PLUS,
    profileAccess: EMPRENDE_PLUS,
    model: "fast",
    temperature: 0.0,
    tools: ["get_workspace_data"],
    systemPrompt: PROMPT_INJECTION_REVIEW_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "security-compliance",
    name: "Security / Compliance Agent",
    role: "Mandatory gate before any PR touching sensitive areas.",
    tierAccess: TIER_3_PLUS,
    profileAccess: DIAGNOSTIC_PLUS,
    model: "reasoning",
    temperature: 0.0,
    tools: ["read_github_file"],
    systemPrompt: SECURITY_COMPLIANCE_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
  {
    slug: "code-fix-proposal",
    name: "Code Fix Proposal Agent",
    role: "Reads real code and produces complete, reviewable file fixes.",
    tierAccess: TIER_3_PLUS,
    profileAccess: ENGINEERING_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: [
      "get_workspace_data",
      "read_github_file",
      "search_github_code",
      "get_recent_commits",
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
    profileAccess: ENGINEERING_PLUS,
    model: "reasoning",
    temperature: 0.1,
    tools: ["read_github_file", "get_recent_commits"],
    systemPrompt: PR_REVIEW_PROMPT,
    canCreatePr: false,
    requiresSecurityReview: false,
    requiresHumanApproval: false,
  },
];

// ── Lookups ──────────────────────────────────────────────────────────────────

const BY_SLUG = new Map<SupportAgentSlug, SupportAgentDefinition>(
  SUPPORT_AGENTS.map((a) => [a.slug, a]),
);

export function getSupportAgent(slug: SupportAgentSlug): SupportAgentDefinition | undefined {
  return BY_SLUG.get(slug);
}

/** All agents a given tier is allowed to use (backward compat). */
export function getAgentsForTier(tier: SupportTier): SupportAgentDefinition[] {
  return SUPPORT_AGENTS.filter((a) => a.tierAccess.includes(tier));
}

/** Whether a tier may use a specific agent (backward compat). */
export function tierCanUseAgent(tier: SupportTier, slug: SupportAgentSlug): boolean {
  return getSupportAgent(slug)?.tierAccess.includes(tier) ?? false;
}

/** Whether a profile may use a specific agent. */
export function profileCanUseAgent(profile: SupportProfile, slug: SupportAgentSlug): boolean {
  return getSupportAgent(slug)?.profileAccess.includes(profile) ?? false;
}

/** All agents a given profile may use. */
export function getAgentsForProfile(profile: SupportProfile): SupportAgentDefinition[] {
  return SUPPORT_AGENTS.filter((a) => a.profileAccess.includes(profile));
}

/** Resolve a plan to its SupportProfile. */
export function planToProfile(plan: string | undefined): SupportProfile {
  return PLAN_TO_SUPPORT_PROFILE[plan ?? "FREE"] ?? "FREE_GUIDED";
}

// ── Profile Policies ────────────────────────────────────────────────────────

/**
 * Capability policies per profile.
 * Every profile gets real agents. Depth differs — quality doesn't.
 */
const PROFILE_POLICIES: Record<SupportProfile, SupportProfilePolicy> = {
  FREE_GUIDED: {
    profile: "FREE_GUIDED",
    allowedAgents: [
      "intake-triage", "feature-router", "user-communication", "human-handoff",
      "workspace-permissions", "inbox-conversation",
    ],
    allowedTools: ["get_workspace_data", "get_recent_errors"],
    maxAgentRunsPerDay: 10,
    maxContextMessages: 20,
    canReadLogs: false,
    canReadCode: false,
    canCreateFixProposal: false,
    canCreatePrDraft: false,
    requiresHumanApprovalFor: ["human-handoff"],
  },
  EMPRENDE_OPERATIONS: {
    profile: "EMPRENDE_OPERATIONS",
    allowedAgents: [
      "intake-triage", "feature-router", "evidence-collector", "consensus-arbiter",
      "user-communication", "human-handoff",
      "workspace-permissions", "inbox-conversation",
      "channel-integration", "provider-events",
      "crm-contacts", "tasks-agent", "sales-pipeline",
      "products-catalog", "workflow-automation",
      "billing-subscription", "hacienda-invoicing", "documents-storage",
      "ai-behavior", "ai-privacy-safety", "prompt-injection-review",
    ],
    allowedTools: ["get_workspace_data", "get_recent_errors", "get_channel_status", "get_billing_status"],
    maxAgentRunsPerDay: 30,
    maxContextMessages: 50,
    canReadLogs: false,
    canReadCode: false,
    canCreateFixProposal: false,
    canCreatePrDraft: false,
    requiresHumanApprovalFor: ["billing-subscription", "hacienda-invoicing", "human-handoff"],
  },
  STARTER_OPERATIONS: {
    profile: "STARTER_OPERATIONS",
    allowedAgents: [
      "intake-triage", "feature-router", "evidence-collector", "consensus-arbiter",
      "user-communication", "human-handoff",
      "workspace-permissions", "inbox-conversation",
      "channel-integration", "provider-events",
      "crm-contacts", "tasks-agent", "sales-pipeline",
      "products-catalog", "workflow-automation",
      "billing-subscription", "hacienda-invoicing", "documents-storage",
      "ai-behavior", "ai-privacy-safety", "prompt-injection-review",
    ],
    allowedTools: ["get_workspace_data", "get_recent_errors", "get_channel_status", "get_billing_status"],
    maxAgentRunsPerDay: 50,
    maxContextMessages: 75,
    canReadLogs: false,
    canReadCode: false,
    canCreateFixProposal: false,
    canCreatePrDraft: false,
    requiresHumanApprovalFor: ["billing-subscription", "hacienda-invoicing", "human-handoff"],
  },
  GROWTH_DIAGNOSTIC: {
    profile: "GROWTH_DIAGNOSTIC",
    allowedAgents: [
      "intake-triage", "feature-router", "evidence-collector", "consensus-arbiter",
      "user-communication", "human-handoff",
      "workspace-permissions", "inbox-conversation",
      "channel-integration", "provider-events",
      "crm-contacts", "tasks-agent", "sales-pipeline",
      "products-catalog", "workflow-automation",
      "billing-subscription", "hacienda-invoicing", "documents-storage",
      "technical-diagnostic", "security-compliance",
      "ai-behavior", "ai-privacy-safety", "prompt-injection-review",
    ],
    allowedTools: [
      "get_workspace_data", "get_recent_errors", "get_channel_status",
      "get_billing_status", "get_railway_logs",
    ],
    maxAgentRunsPerDay: 75,
    maxContextMessages: 100,
    canReadLogs: true,
    canReadCode: true,
    canCreateFixProposal: false,
    canCreatePrDraft: false,
    requiresHumanApprovalFor: ["billing-subscription", "hacienda-invoicing", "human-handoff"],
  },
  BUSINESS_ADVANCED: {
    profile: "BUSINESS_ADVANCED",
    allowedAgents: [
      "intake-triage", "feature-router", "evidence-collector", "consensus-arbiter",
      "user-communication", "human-handoff",
      "workspace-permissions", "inbox-conversation",
      "channel-integration", "provider-events",
      "crm-contacts", "tasks-agent", "sales-pipeline",
      "products-catalog", "workflow-automation",
      "billing-subscription", "hacienda-invoicing", "documents-storage",
      "technical-diagnostic", "security-compliance",
      "ai-behavior", "ai-privacy-safety", "prompt-injection-review",
    ],
    allowedTools: [
      "get_workspace_data", "get_recent_errors", "get_channel_status",
      "get_billing_status", "get_railway_logs",
      "read_github_file", "search_github_code", "get_recent_commits",
    ],
    maxAgentRunsPerDay: 150,
    maxContextMessages: 200,
    canReadLogs: true,
    canReadCode: true,
    canCreateFixProposal: true,
    canCreatePrDraft: false,
    requiresHumanApprovalFor: ["billing-subscription", "hacienda-invoicing", "human-handoff", "code-fix-proposal"],
  },
  BUSINESS_PLUS_ENGINEERING: {
    profile: "BUSINESS_PLUS_ENGINEERING",
    allowedAgents: [
      "intake-triage", "feature-router", "evidence-collector", "consensus-arbiter",
      "user-communication", "human-handoff",
      "workspace-permissions", "inbox-conversation",
      "channel-integration", "provider-events",
      "crm-contacts", "tasks-agent", "sales-pipeline",
      "products-catalog", "workflow-automation",
      "billing-subscription", "hacienda-invoicing", "documents-storage",
      "technical-diagnostic", "code-fix-proposal", "pr-review", "security-compliance",
      "ai-behavior", "ai-privacy-safety", "prompt-injection-review",
    ],
    allowedTools: [
      "get_workspace_data", "get_recent_errors", "get_channel_status",
      "get_billing_status", "get_railway_logs",
      "read_github_file", "search_github_code", "get_recent_commits",
      "create_github_pr",
    ],
    maxAgentRunsPerDay: 300,
    maxContextMessages: 300,
    canReadLogs: true,
    canReadCode: true,
    canCreateFixProposal: true,
    canCreatePrDraft: true,
    requiresHumanApprovalFor: ["billing-subscription", "hacienda-invoicing", "human-handoff", "code-fix-proposal"],
  },
  ENTERPRISE_CUSTOM: {
    profile: "ENTERPRISE_CUSTOM",
    allowedAgents: SUPPORT_AGENTS.map((a) => a.slug), // all 25
    allowedTools: [
      "get_workspace_data", "get_recent_errors", "get_channel_status",
      "get_billing_status", "get_railway_logs",
      "read_github_file", "search_github_code", "get_recent_commits",
      "create_github_pr",
    ],
    maxAgentRunsPerDay: "unlimited",
    maxContextMessages: 500,
    canReadLogs: true,
    canReadCode: true,
    canCreateFixProposal: true,
    canCreatePrDraft: true,
    requiresHumanApprovalFor: ["billing-subscription", "hacienda-invoicing", "human-handoff", "code-fix-proposal"],
  },
};

export function getProfilePolicy(profile: SupportProfile): SupportProfilePolicy {
  return PROFILE_POLICIES[profile];
}

// ── Tier → PR creation gating (backward compat) ────────────────────────────

export function tierAllowsPrCreation(tier: SupportTier, allowPrOverride = false): boolean {
  if (tier === "TIER_4") return true;
  if (tier === "TIER_3") return allowPrOverride === true;
  return false;
}

// ── Dynamic Agent Groups ────────────────────────────────────────────────────

/**
 * Feature-based agent groups.
 * The router classifies the case into a feature, and we assemble the right
 * specialists. Every group includes council agents for triage + communication.
 */
export const AGENT_GROUPS: Record<SupportFeature, SupportAgentSlug[]> = {
  CHANNEL_DELIVERY_ISSUE: [
    "intake-triage",
    "support-supervisor",
    "evidence-collector",
    "inbox-conversation",
    "channel-integration",
    "provider-events",
    "technical-diagnostic",
    "consensus-arbiter",
    "user-communication",
  ],
  HACIENDA_REJECTION: [
    "intake-triage",
    "support-supervisor",
    "evidence-collector",
    "hacienda-invoicing",
    "billing-subscription",
    "documents-storage",
    "technical-diagnostic",
    "consensus-arbiter",
    "user-communication",
  ],
  AI_AGENT_BAD_RESPONSE: [
    "intake-triage",
    "support-supervisor",
    "ai-behavior",
    "ai-privacy-safety",
    "prompt-injection-review",
    "inbox-conversation",
    "consensus-arbiter",
    "user-communication",
  ],
  WORKFLOW_NOT_RUNNING: [
    "intake-triage",
    "support-supervisor",
    "evidence-collector",
    "workflow-automation",
    "crm-contacts",
    "tasks-agent",
    "technical-diagnostic",
    "consensus-arbiter",
    "user-communication",
  ],
  BILLING_ISSUE: [
    "intake-triage",
    "support-supervisor",
    "billing-subscription",
    "workspace-permissions",
    "consensus-arbiter",
    "user-communication",
  ],
  SECURITY_CONCERN: [
    "intake-triage",
    "support-supervisor",
    "security-compliance",
    "ai-privacy-safety",
    "prompt-injection-review",
    "workspace-permissions",
    "consensus-arbiter",
    "human-handoff",
  ],
  UI_BUG: [
    "intake-triage",
    "support-supervisor",
    "evidence-collector",
    "technical-diagnostic",
    "consensus-arbiter",
    "user-communication",
  ],
  API_ERROR: [
    "intake-triage",
    "support-supervisor",
    "evidence-collector",
    "technical-diagnostic",
    "consensus-arbiter",
    "user-communication",
  ],
  PERFORMANCE_DEGRADATION: [
    "intake-triage",
    "support-supervisor",
    "evidence-collector",
    "technical-diagnostic",
    "consensus-arbiter",
    "user-communication",
  ],
  DATA_INTEGRITY: [
    "intake-triage",
    "support-supervisor",
    "evidence-collector",
    "technical-diagnostic",
    "consensus-arbiter",
    "user-communication",
  ],
  GENERAL_INQUIRY: [
    "intake-triage",
    "support-supervisor",
    "user-communication",
  ],
};

/**
 * Assemble the agent group for a case, filtered by profile capabilities.
 */
export function buildAgentGroup(
  feature: SupportFeature,
  profile: SupportProfile,
): SupportAgentSlug[] {
  const policy = getProfilePolicy(profile);
  const group = AGENT_GROUPS[feature] ?? AGENT_GROUPS.GENERAL_INQUIRY;

  // Filter to agents the profile may use, preserving order, removing duplicates.
  const seen = new Set<SupportAgentSlug>();
  return group.filter((slug) => {
    if (seen.has(slug)) return false;
    seen.add(slug);
    return policy.allowedAgents.includes(slug);
  });
}

/**
 * Map a legacy case_type to the new SupportFeature for routing.
 */
export function caseTypeToFeature(caseType: string): SupportFeature {
  switch (caseType) {
    case "provider_issue":
      return "CHANNEL_DELIVERY_ISSUE";
    case "billing":
      return "BILLING_ISSUE";
    case "security":
      return "SECURITY_CONCERN";
    case "bug":
      return "API_ERROR";
    case "configuration":
    case "user_error":
    case "unknown":
    default:
      return "GENERAL_INQUIRY";
  }
}
