/**
 * Support pipeline planner — pure routing logic (no I/O).
 *
 * Given a tier and the triage classification, decide the ordered list of
 * specialized agents to run. Human handoff is ONLY for truly non-automatable
 * actions (financial transactions, production deploys). Security and billing
 * cases go through their specialized agents — they can diagnose, explain, and
 * recommend. Human is only for the final merge/action decision.
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
 *
 * PHILOSOPHY: Agents SOLVE problems. Human handoff is ONLY for actions that
 * literally cannot be automated (money movement, production deploys).
 * Diagnosing, explaining, and proposing fixes is what agents DO.
 */
export function buildPipeline(input: PipelinePlanInput): SupportAgentSlug[] {
  const { tier, caseType, severity } = input;
  const stages: SupportAgentSlug[] = [];

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
      // If the channel agent suspects it's a code bug, route to diagnostic
      break;
    case "configuration":
    case "user_error":
      stages.push("customer-support");
      break;
    case "billing":
      // Billing agent can diagnose, explain plans, check limits, and recommend.
      // Human handoff only triggered by the agent itself when actual money
      // movement is needed (refund, plan change, etc.)
      stages.push("billing-subscription");
      break;
    case "security":
      // Security agent reviews the case. It decides whether to block or pass.
      // Human handoff only for confirmed critical risks.
      stages.push("security-compliance");
      break;
    case "unknown":
    default:
      stages.push("customer-support");
      break;
  }

  // Human handoff is ONLY added when agents explicitly flag needs_human_review.
  // We do NOT auto-append it here — agents are capable of resolving most cases
  // on their own. The human-handoff stage is triggered by the orchestrator
  // when needs_human_review is true AND the case requires human action.

  // Filter to what the tier is actually allowed to use, preserving order and
  // removing duplicates.
  const seen = new Set<SupportAgentSlug>();
  return stages.filter((slug) => {
    if (seen.has(slug)) return false;
    seen.add(slug);
    return tierCanUseAgent(tier, slug);
  });
}
