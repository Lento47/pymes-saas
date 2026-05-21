export type ChannelTab =
  | "ALL"
  | "WHATSAPP"
  | "TELEGRAM"
  | "EMAIL"
  | "FORM"
  | "UNASSIGNED"
  | "MINE";

export type ConversationStatusFilter =
  | "ALL"
  | "NEW"
  | "OPEN"
  | "PENDING"
  | "RESOLVED";

export type ConversationPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

export type ConversationChannelType =
  | "WHATSAPP"
  | "TELEGRAM"
  | "EMAIL"
  | "FORM"
  | string;

export interface InboxConversation {
  id: string;
  subject?: string | null;
  status: string;
  priority?: string | null;
  last_message_at?: string | null;
  updated_at?: string | null;
  is_service_window_open?: boolean;
  service_window_expires_at?: string | null;
  assigned_user?: {
    id: string;
    full_name?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  contact?: {
    id: string;
    full_name?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
  } | null;
  channel?: {
    id: string;
    name?: string | null;
    type?: string | null;
  } | null;
  is_service_window_open?: boolean;
  service_window_expires_at?: string | null;
  messages?: Array<{
    id?: string;
    body_text?: string | null;
    direction?: string;
    created_at?: string | null;
  }>;
}

export const STATUS_OPTIONS = ["ALL", "NEW", "OPEN", "PENDING", "RESOLVED"] as const;
