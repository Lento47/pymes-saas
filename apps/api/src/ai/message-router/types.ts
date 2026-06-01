export type ChannelType = "WHATSAPP" | "TELEGRAM" | "EMAIL" | "WEBCHAT" | "INSTAGRAM";

export type Intent =
  | "greeting"
  | "product_question"
  | "price_question"
  | "invoice_request"
  | "payment_status"
  | "complaint"
  | "technical_support"
  | "sales_lead"
  | "human_request"
  | "opt_out"
  | "spam"
  | "unknown";

export type SendMode =
  | "freeform"
  | "internal_template"
  | "meta_template"
  | "catalog_message"
  | "interactive_message"
  | "document";

export interface IncomingMessageEvent {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  contactId: string | null;
  text: string;
  receivedAt: Date;
  isInteractive?: boolean;
}

export interface ConversationContext {
  workspaceId: string;
  contactId: string | null;
  channel: ChannelType;
  lastCustomerMessageAt: Date | null;
  isServiceWindowOpen: boolean;
  conversationStatus: string;
  aiState: "AI_ACTIVE" | "HUMAN_ACTIVE" | "IDLE";
  human_handover_at?: string | null;
  workspacePlan: string;
  aiAgentAutoActive: boolean;
  aiSettings?: { ai_always_respond?: boolean; human_handover_timeout_ms?: number };
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface PolicyDecision {
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason: string;
  riskLevel: "low" | "medium" | "high";
}

export interface SendPlan {
  channel: ChannelType;
  mode: SendMode;
  requiresApproval: boolean;
  reason: string;
}

export type AgentType = "sales" | "support" | "billing" | "human" | "general";

export type ModelTier = "fast" | "balanced" | "powerful";

export interface ContextEnrichment {
  summary: string;
  data: Record<string, unknown>;
}

export interface RouterDecision {
  intent: Intent;
  intentConfidence: "high" | "medium" | "low";
  policy: PolicyDecision;
  sendPlan: SendPlan | null;
  shouldCallAi: boolean;
  quickReplyText?: string;
  agentType?: AgentType;
  modelTier?: ModelTier;
  systemPromptAddendum?: string;
  contextEnrichment?: ContextEnrichment;
}
