import { Injectable } from "@nestjs/common";
import { ConversationContext, Intent, PolicyDecision } from "./types";

@Injectable()
export class PolicyEngineService {
  evaluate(context: ConversationContext, intent: Intent): PolicyDecision {
    // Human agent has taken over — AI must not reply
    if (context.aiState === "HUMAN_ACTIVE") {
      return {
        allowed: false,
        requiresHumanApproval: false,
        reason: "human_active",
        riskLevel: "low",
      };
    }

    // Workspace AI auto-reply is disabled and this conversation hasn't been explicitly activated
    if (!context.aiAgentAutoActive && context.aiState !== "AI_ACTIVE") {
      return {
        allowed: false,
        requiresHumanApproval: false,
        reason: "ai_disabled",
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
