/**
 * Support OS — dynamic agent group pipeline.
 *
 * Given a feature classification and a profile, assemble the ordered list
 * of specialist agents to run. Triage (`intake-triage`) is assumed to have
 * already run. The returned list is filtered by profile capabilities.
 *
 * Unlike the old `buildPipeline`, this doesn't hardcode 6 case types.
 * Agent groups are defined declaratively in `AGENT_GROUPS` and filtered
 * by `SupportProfilePolicy.allowedAgents`.
 */

import type { SupportAgentSlug, SupportFeature, SupportProfile } from "./support-agent.types";
import { buildAgentGroup, caseTypeToFeature, getProfilePolicy, profileCanUseAgent } from "./support-agents.catalog";

export interface PipelinePlanInput {
  profile: SupportProfile;
  feature: SupportFeature;
  /** Whether the triage classified this as needing human attention. */
  needsHuman?: boolean;
}

/**
 * Build the ordered agent group for a feature.
 * Includes optional code-fix and PR-review stages for profiles that support them.
 */
export function buildPipelineByFeature(input: PipelinePlanInput): SupportAgentSlug[] {
  const { profile, feature, needsHuman } = input;
  const policy = getProfilePolicy(profile);

  const group = buildAgentGroup(feature, profile);

  // Append code-fix → security → PR path for engineering-capable profiles
  if (policy.canCreateFixProposal && group.includes("technical-diagnostic")) {
    if (profileCanUseAgent(profile, "code-fix-proposal")) {
      group.push("code-fix-proposal");
    }
    if (profileCanUseAgent(profile, "security-compliance")) {
      group.push("security-compliance");
    }
    if (policy.canCreatePrDraft && profileCanUseAgent(profile, "pr-review")) {
      group.push("pr-review");
    }
  }

  // Human handoff for profiles that need it on sensitive cases
  if (needsHuman && profileCanUseAgent(profile, "human-handoff")) {
    group.push("human-handoff");
  }

  return group;
}

// ── Backward compatibility — kept for existing callers ──────────────────────

import type { SupportCaseType, SupportSeverity, SupportTier } from "./support-agent.types";
import { tierCanUseAgent, tierAllowsPrCreation } from "./support-agents.catalog";

/** @deprecated Use `buildPipelineByFeature` with profiles instead. */
export interface LegacyPipelineInput {
  tier: SupportTier;
  caseType: SupportCaseType;
  severity?: SupportSeverity;
  /** Tier 3 opt-in to allow the fix→PR branch. */
  allowPrOverride?: boolean;
}

/** @deprecated Use `buildPipelineByFeature` with profiles instead. */
export function buildPipeline(input: LegacyPipelineInput): SupportAgentSlug[] {
  const { tier, caseType, severity } = input;
  const feature = caseTypeToFeature(caseType);
  const stages: SupportAgentSlug[] = [];

  // Use the new feature-based routing but filter by tier for backward compat
  const featureGroup = buildAgentGroup(feature, "ENTERPRISE_CUSTOM"); // full group
  for (const slug of featureGroup) {
    if (slug === "intake-triage" || slug === "user-communication") continue; // already handled
    if (tierCanUseAgent(tier, slug)) {
      stages.push(slug);
    }
  }

  // Code-fix branch for tiers that can propose code
  if (caseType === "bug" && tierCanUseAgent(tier, "code-fix-proposal")) {
    stages.push("code-fix-proposal");
    stages.push("security-compliance");
    if (tierAllowsPrCreation(tier, input.allowPrOverride ?? false)) {
      stages.push("pr-review");
    }
  }

  // Dedup
  const seen = new Set<SupportAgentSlug>();
  return stages.filter((slug) => {
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}
