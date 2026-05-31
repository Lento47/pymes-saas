import { Injectable } from "@nestjs/common";
import { AiPrivacyContext } from "./types";

@Injectable()
export class AiContextMinimizerService {
  minimize(context?: AiPrivacyContext): AiPrivacyContext {
    if (!context) {
      return {};
    }

    return {
      businessName: context.businessName,
      businessDescription: context.businessDescription,
      businessPolicies: context.businessPolicies,
      customerSummary: context.customerSummary,
      allowedActions: Array.isArray(context.allowedActions) ? [...context.allowedActions] : undefined,
      recentMessages: Array.isArray(context.recentMessages)
        ? context.recentMessages.slice(-8).map((message) => ({
            role: message.role,
            content: message.content,
          }))
        : undefined,
    };
  }
}
