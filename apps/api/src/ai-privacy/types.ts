export type AiPurpose =
  | "CUSTOMER_SUPPORT"
  | "SALES_ASSISTANT"
  | "CRM_SUMMARY"
  | "TASK_AUTOMATION"
  | "BILLING_HELP"
  | "INTERNAL_DIAGNOSTIC";

export type AiMessageRole = "customer" | "agent" | "system";

export interface AiRecentMessage {
  role: AiMessageRole;
  content: string;
  createdAt?: string;
}

export interface AiPrivacyContext {
  businessName?: string;
  businessDescription?: string;
  businessPolicies?: string;
  recentMessages?: AiRecentMessage[];
  customerSummary?: string;
  allowedActions?: string[];
}

export interface AiPrivacyRequest {
  workspaceId: string;
  actorId?: string;
  customerId?: string;
  conversationId?: string;
  purpose: AiPurpose;
  userMessage: string;
  context?: AiPrivacyContext;
  allowSensitiveData?: boolean;
}

export interface AiPrivacyResponse {
  content: string;
  piiDetected: string[];
}

export interface SafeLlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
