import { Injectable } from "@nestjs/common";
import { ConversationContext, Intent, PolicyDecision } from "./types";
import { isAiBlockedByHuman } from "../ai-gating";

@Injectable()
export class PolicyEngineService {
  evaluate(context: ConversationContext, intent: Intent): PolicyDecision {
    // Human agent has taken over recently — AI must not reply (3 min timeout)
    if (isAiBlockedByHuman({ ai_state: context.aiState, human_handover_at: context.human_handover_at })) {
      return {
        allowed: false,
        requiresHumanApproval: false,
        reason: "human_active",
        riskLevel: "low",
      };
    }

    // Customer opted out — never reply automatically
    if (intent === "opt_out") {
      return {
        allowed: false,
        requiresHumanApproval: false,
        reason: "opt_out",
        riskLevel: "low",
      };
    }

    // Spam — block silently
    if (intent === "spam") {
      return {
        allowed: false,
        requiresHumanApproval: false,
        reason: "spam_detected",
        riskLevel: "medium",
      };
    }

    // Fiscal/payment intents: AI can respond but must not create invoices or process payments autonomously
    if (intent === "invoice_request" || intent === "payment_status") {
      return {
        allowed: true,
        requiresHumanApproval: false,
        reason: "fiscal_intent_ai_assist",
        riskLevel: "medium",
      };
    }

    // Human escalation request: AI handles by acknowledging and routing
    if (intent === "human_request") {
      return {
        allowed: true,
        requiresHumanApproval: false,
        reason: "human_handoff_allowed",
        riskLevel: "low",
      };
    }

    return {
      allowed: true,
      requiresHumanApproval: false,
      reason: "allowed",
      riskLevel: "low",
    };
  }
}
