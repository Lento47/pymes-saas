export enum WorkspaceStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  DELETED = 'DELETED',
}

export enum WorkspacePlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE', // Legacy — maps to BUSINESS
  BUSINESS_PLUS = 'BUSINESS_PLUS',
}

export enum WorkspaceUserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

export enum BillingProvider {
  MANUAL = 'MANUAL',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  BAC = 'BAC',
  CUSTOM = 'CUSTOM',
}

export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  ONE_TIME = 'ONE_TIME',
  CUSTOM = 'CUSTOM',
}

export enum WorkspaceSubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  UNPAID = 'UNPAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  MANUAL = 'MANUAL',
}
