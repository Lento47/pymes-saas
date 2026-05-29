import { Injectable } from "@nestjs/common";
import { ChannelType, ConversationContext, Intent, SendPlan } from "./types";

@Injectable()
export class SmartSendService {
  /**
   * Determines the optimal channel and send mode for an outbound reply.
   * Does NOT send anything — callers use the plan to gate the actual send.
   */
  plan(context: ConversationContext, intent: Intent): SendPlan {
    const { channel, isServiceWindowOpen } = context;

    if (channel === "WHATSAPP") {
      // Fiscal documents should go by email when WhatsApp window is closed
      if (!isServiceWindowOpen && (intent === "invoice_request" || intent === "payment_status")) {
        return {
          channel: "EMAIL",
          mode: "document",
          requiresApproval: false,
          reason: "WhatsApp window closed — fiscal document sent by email",
        };
      }

      // Outside 24h service window: Meta-approved template required
      if (!isServiceWindowOpen) {
        return {
          channel: "WHATSAPP",
          mode: "meta_template",
          requiresApproval: true,
          reason: "Outside WhatsApp 24h service window — Meta template required",
        };
      }

      // Within window: freeform reply allowed
      return {
        channel: "WHATSAPP",
        mode: "freeform",
        requiresApproval: false,
        reason: "Within WhatsApp 24h service window",
      };
    }

    // Telegram, email, webchat: always freeform
    return {
      channel,
      mode: "freeform",
      requiresApproval: false,
      reason: `Channel ${channel} — freeform allowed`,
    };
  }

  /**
   * Returns a human-readable summary of the send plan for UI display.
   * Used in agent UI to explain the routing decision to the operator.
   */
  describe(plan: SendPlan): string {
    if (!plan.requiresApproval) {
      return `Se puede responder por ${plan.channel} (${plan.mode}).`;
    }
    return `Para enviar por ${plan.channel} se requiere una plantilla oficial aprobada por Meta. Recomendado: enviar por email o esperar a que el cliente escriba primero.`;
  }
}
