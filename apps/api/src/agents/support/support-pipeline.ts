/**
 * Support pipeline planner — pure routing logic (no I/O).
 *
 * Given a tier and the triage classification, decide the ordered list of
 * specialized agents to run. Kept pure so it is trivially unit-testable and
 * has no way to perform a privileged action itself.
 */
import type {
  SupportAgentSlug,
  SupportCaseType,
  SupportSeverity,
  SupportTier,
} from "./support-agent.types";
import { tierCanUseAgent, tierAllowsPrCreation } from "./support-agents.catalog";

export interface PipelinePlanInput {
  tier: SupportTier;
  caseType: SupportCaseType;
  severity: SupportSeverity;
  /** Tier 3 opt-in to allow the fix→PR branch. */
  allowPrOverride?: boolean;
}

/**
 * Build the ordered agent pipeline AFTER triage has classified the case.
 * Triage (`intake-triage`) is assumed to have already run. The returned list
 * is filtered to agents the tier may actually use.
 */
export function buildPipeline(input: PipelinePlanInput): SupportAgentSlug[] {
  const { tier, caseType, severity } = input;
  const stages: SupportAgentSlug[] = [];

  const isSensitive = severity === "high" || severity === "critical";

  switch (caseType) {
    case "bug": {
      stages.push("technical-diagnostic");
      // Code-fix branch only for tiers that can propose code.
      if (tierCanUseAgent(tier, "code-fix-proposal")) {
        stages.push("code-fix-proposal");
        // Security review is mandatory before any PR.
        stages.push("security-compliance");
        // Only chain pr-review when the tier may actually open PRs.
        if (tierAllowsPrCreation(tier, input.allowPrOverride ?? false)) {
          stages.push("pr-review");
        }
      }
      break;
    }
    case "provider_issue":
      stages.push("channel-integration");
      break;
    case "configuration":
    case "user_error":
      stages.push("customer-support");
      break;
    case "billing":
      stages.push("billing-subscription");
      break;
    case "security":
      stages.push("security-compliance");
      break;
    case "unknown":
    default:
      stages.push("customer-support");
      break;
  }

  // Always end with a human handoff for sensitive/critical cases, billing, or
  // security — these can never be auto-resolved.
  if (isSensitive || caseType === "billing" || caseType === "security") {
    stages.push("human-handoff");
  }

  // Filter to what the tier is actually allowed to use, preserving order and
  // removing duplicates.
  const seen = new Set<SupportAgentSlug>();
  return stages.filter((slug) => {
    if (seen.has(slug)) return false;
    seen.add(slug);
    return tierCanUseAgent(tier, slug);
  });
}
