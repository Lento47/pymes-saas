export enum ChannelType {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  FORM = 'FORM',
  API = 'API',
  MANUAL = 'MANUAL',
}

export enum ChannelStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  PENDING_SETUP = 'PENDING_SETUP',
}

export enum ConversationStatus {
  NEW = 'NEW',
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  INTERNAL = 'INTERNAL',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}
