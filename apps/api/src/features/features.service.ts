import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

export interface FeatureFlags {
  contacts: boolean;
  orders: boolean;
  reminders: boolean;
  conversations: boolean;
  whatsapp_inbox: boolean;
  billing: boolean;
  automations: boolean;
  dashboard: boolean;
  roles: boolean;
  reports: boolean;
  api_access: boolean;
  multi_location: boolean;
  audit_logs: boolean;
}

export interface FeatureLimits {
  "contacts.max": number;
  "users.max": number;
  "channels.max": number;
  "orders.monthly_max": number;
  "invoices.monthly_max": number;
  "automations.max": number;
  "storage.gb": number;
}

export interface WorkspaceFeatures {
  plan: string;
  beta_profile: string | null;
  features: FeatureFlags;
  limits: FeatureLimits;
}

const ALL_FEATURES_ON: FeatureFlags = {
  contacts: true,
  orders: true,
  reminders: true,
  conversations: true,
  whatsapp_inbox: true,
  billing: true,
  automations: true,
  dashboard: true,
  roles: true,
  reports: true,
  api_access: true,
  multi_location: true,
  audit_logs: true,
};

const PLAN_FEATURES: Record<string, FeatureFlags> = {
  FREE: {
    ...ALL_FEATURES_ON,
    roles: false,
    reports: false,
    api_access: false,
    multi_location: false,
    audit_logs: false,
  },
  EMPRENDE: {
    ...ALL_FEATURES_ON,
    roles: false,
    reports: false,
    api_access: false,
    multi_location: false,
    audit_logs: false,
  },
  STARTER: { ...ALL_FEATURES_ON, multi_location: false, audit_logs: false },
  GROWTH: { ...ALL_FEATURES_ON, audit_logs: false },
  BUSINESS: { ...ALL_FEATURES_ON },
  ENTERPRISE: { ...ALL_FEATURES_ON },
  BUSINESS_PLUS: { ...ALL_FEATURES_ON },
};

// "Unlimited" sentinel for enterprise tiers — high enough for practical purposes.
// Not Number.MAX_SAFE_INTEGER to avoid JSON serialization precision issues.
const UNLIMITED = 999_999;

const PLAN_LIMITS: Record<string, FeatureLimits> = {
  FREE: {
    "contacts.max": 100,
    "users.max": 1,
    "channels.max": 1,
    "orders.monthly_max": 50,
    "invoices.monthly_max": 50,
    "automations.max": 5,
    "storage.gb": 0.1,
  },
  STARTER: {
    "contacts.max": 500,
    "users.max": 3,
    "channels.max": 2,
    "orders.monthly_max": 200,
    "invoices.monthly_max": 200,
    "automations.max": 25,
    "storage.gb": 1,
  },
  GROWTH: {
    "contacts.max": 5000,
    "users.max": 10,
    "channels.max": 5,
    "orders.monthly_max": 1000,
    "invoices.monthly_max": 1000,
    "automations.max": 100,
    "storage.gb": 10,
  },
  EMPRENDE: {
    "contacts.max": 500,
    "users.max": 1,
    "channels.max": 1,
    "orders.monthly_max": 50,
    "invoices.monthly_max": 25,
    "automations.max": 3,
    "storage.gb": 0.5,
  },
  BUSINESS: {
    "contacts.max": 50000,
    "users.max": 50,
    "channels.max": 20,
    "orders.monthly_max": 5000,
    "invoices.monthly_max": 5000,
    "automations.max": 500,
    "storage.gb": 50,
  },
  ENTERPRISE: {
    "contacts.max": UNLIMITED,
    "users.max": UNLIMITED,
    "channels.max": UNLIMITED,
    "orders.monthly_max": UNLIMITED,
    "invoices.monthly_max": UNLIMITED,
    "automations.max": UNLIMITED,
    "storage.gb": UNLIMITED,
  },
  BUSINESS_PLUS: {
    "contacts.max": UNLIMITED,
    "users.max": UNLIMITED,
    "channels.max": UNLIMITED,
    "orders.monthly_max": UNLIMITED,
    "invoices.monthly_max": UNLIMITED,
    "automations.max": UNLIMITED,
    "storage.gb": UNLIMITED,
  },
};

const BETA_PROFILE_FEATURES: Record<string, Partial<FeatureFlags>> = {
  BETA_LIGHT: {
    contacts: true,
    orders: true,
    reminders: true,
    dashboard: true,
    conversations: false,
    whatsapp_inbox: false,
    billing: false,
    automations: false,
    roles: false,
    reports: false,
    api_access: false,
    multi_location: false,
    audit_logs: false,
  },
  BETA_CONVERSATIONS: {
    contacts: true,
    orders: false,
    reminders: true,
    conversations: true,
    whatsapp_inbox: true,
    billing: false,
    automations: false,
    dashboard: true,
    roles: false,
    reports: false,
    api_access: false,
    multi_location: false,
    audit_logs: false,
  },
  BETA_OPERATIONS: {
    contacts: true,
    orders: true,
    reminders: true,
    conversations: true,
    whatsapp_inbox: false,
    billing: false,
    automations: false,
    dashboard: true,
    roles: true,
    reports: false,
    api_access: false,
    multi_location: false,
    audit_logs: false,
  },
};

const BETA_PROFILE_LIMITS: Record<string, Partial<FeatureLimits>> = {
  BETA_LIGHT: {
    "contacts.max": 150,
    "users.max": 1,
    "channels.max": 0,
    "orders.monthly_max": 100,
    "invoices.monthly_max": 0,
    "automations.max": 0,
    "storage.gb": 1,
  },
  BETA_CONVERSATIONS: {
    "contacts.max": 300,
    "users.max": 2,
    "channels.max": 1,
    "orders.monthly_max": 0,
    "invoices.monthly_max": 0,
    "automations.max": 0,
    "storage.gb": 2,
  },
  BETA_OPERATIONS: {
    "contacts.max": 500,
    "users.max": 3,
    "channels.max": 1,
    "orders.monthly_max": 300,
    "invoices.monthly_max": 0,
    "automations.max": 0,
    "storage.gb": 3,
  },
};

@Injectable()
export class FeaturesService {
  private readonly logger = new Logger(FeaturesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveFeatures(workspaceId: string): Promise<WorkspaceFeatures> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true, beta_profile: true, features_json: true, limits_json: true },
    });

    if (!workspace) {
      throw new ForbiddenException("Workspace not found");
    }

    const plan = workspace.plan;
    const betaProfile = workspace.beta_profile ?? null;

    // Start with plan defaults
    let features: FeatureFlags = { ...(PLAN_FEATURES[plan] ?? ALL_FEATURES_ON) };
    let limits: FeatureLimits = { ...(PLAN_LIMITS[plan] ?? PLAN_LIMITS["FREE"]) };

    // Apply beta profile overrides if set
    if (betaProfile && BETA_PROFILE_FEATURES[betaProfile]) {
      features = { ...features, ...BETA_PROFILE_FEATURES[betaProfile] };
    }
    if (betaProfile && BETA_PROFILE_LIMITS[betaProfile]) {
      limits = { ...limits, ...BETA_PROFILE_LIMITS[betaProfile] };
    }

    // Apply per-workspace overrides from features_json/limits_json
    if (workspace.features_json && typeof workspace.features_json === "object") {
      const overrides = workspace.features_json as Record<string, boolean>;
      for (const key of Object.keys(ALL_FEATURES_ON)) {
        if (typeof overrides[key] === "boolean") {
          (features as any)[key] = overrides[key];
        }
      }
    }
    if (workspace.limits_json && typeof workspace.limits_json === "object") {
      const overrides = workspace.limits_json as Record<string, number>;
      for (const key of Object.keys(limits)) {
        if (typeof overrides[key] === "number") {
          (limits as any)[key] = overrides[key];
        }
      }
    }

    return { plan, beta_profile: betaProfile, features, limits };
  }

  async assertEnabled(workspaceId: string, feature: keyof FeatureFlags): Promise<void> {
    const { features } = await this.getEffectiveFeatures(workspaceId);
    if (!features[feature]) {
      throw new ForbiddenException(
        `Esta función no está activa para tu plan actual. Si creés que la necesitás, contactanos.`,
      );
    }
  }
}
