export enum AutomationExecutionStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum TriggerType {
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  CONVERSATION_CREATED = 'CONVERSATION_CREATED',
  CONVERSATION_STATUS_CHANGED = 'CONVERSATION_STATUS_CHANGED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_OVERDUE = 'TASK_OVERDUE',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_PROCESSED = 'DOCUMENT_PROCESSED',
  SCHEDULED = 'SCHEDULED',
  MANUAL = 'MANUAL',
}

export enum DocumentStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED',
}

export enum DealStatus {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
}

export const NOTIFICATION_TYPES = {
  TASK_COMPLETED: 'task_completed',
  TASK_OVERDUE: 'task_overdue',
  NEW_MESSAGE: 'new_message',
  AI_TASK_CREATED: 'AI_TASK_CREATED',
  DEAL_CREATED: 'deal_created',
  DEAL_STAGE_CHANGED: 'deal_stage_changed',
  DEAL_WON: 'deal_won',
  INVOICE_PAID: 'invoice_paid',
  PAYMENT_RECEIVED: 'payment_received',
  INVOICE_OVERDUE: 'invoice_overdue',
  AUTOMATION: 'automation',
  CONVERSATION_NO_REPLY: 'conversation_no_reply',
} as const;
