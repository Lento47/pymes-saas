import { Injectable } from "@nestjs/common";
import { Intent, ModelTier } from "./types";

export interface ModelSelection {
  modelTier: ModelTier;
  reason: string;
}

@Injectable()
export class ModelSelectorService {
  /**
   * Returns the appropriate model tier for an intent + workspace plan.
   * Pure logic — no I/O.
   *
   * Callers use the tier to select the actual model identifier; this service
   * only decides complexity level so the choice stays in one place.
   */
  selectModel(intent: Intent, workspacePlan: string): ModelSelection {
    // Trivial or blocked intents → cheapest model
    if (
      intent === "greeting" ||
      intent === "spam" ||
      intent === "opt_out" ||
      intent === "unknown"
    ) {
      const isPremium =
        workspacePlan === "ENTERPRISE" || workspacePlan === "BUSINESS_PLUS";
      if (intent === "unknown" && isPremium) {
        return { modelTier: "powerful", reason: "enterprise_unknown_intent" };
      }
      return { modelTier: "fast", reason: "simple_or_deterministic_intent" };
    }

    // Fiscal / payment — accuracy matters
    if (intent === "invoice_request" || intent === "payment_status") {
      return { modelTier: "balanced", reason: "fiscal_accuracy_required" };
    }

    // Complaints — empathy + accuracy
    if (intent === "complaint") {
      return { modelTier: "balanced", reason: "complaint_empathy_required" };
    }

    // Sales / technical on premium plans benefit from stronger reasoning
    if (
      (intent === "sales_lead" || intent === "technical_support") &&
      (workspacePlan === "ENTERPRISE" ||
        workspacePlan === "BUSINESS_PLUS" ||
        workspacePlan === "GROWTH")
    ) {
      return { modelTier: "balanced", reason: "premium_plan_complex_intent" };
    }

    return { modelTier: "fast", reason: "default" };
  }
}
