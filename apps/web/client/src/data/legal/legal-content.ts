import acceptableUsePolicyRaw from "./acceptable-use-policy.md?raw";
import billingRefundsPolicyRaw from "./billing-refunds-policy.md?raw";
import cookiesPolicyRaw from "./cookies-policy.md?raw";
import dataProcessingAddendumRaw from "./data-processing-addendum.md?raw";
import privacyPolicyRaw from "./privacy-policy.md?raw";
import subprocessorsNoticeRaw from "./subprocessors-notice.md?raw";
import termsOfServiceRaw from "./terms-of-service.md?raw";
import whatsappAiPolicyRaw from "./whatsapp-ai-policy.md?raw";

export const LEGAL_CONTENT: Record<string, string> = {
  "terms-of-service": termsOfServiceRaw,
  "privacy-policy": privacyPolicyRaw,
  "data-processing-addendum": dataProcessingAddendumRaw,
  "acceptable-use-policy": acceptableUsePolicyRaw,
  "billing-refunds-policy": billingRefundsPolicyRaw,
  "subprocessors-notice": subprocessorsNoticeRaw,
  "whatsapp-ai-policy": whatsappAiPolicyRaw,
  "cookies-policy": cookiesPolicyRaw,
};
