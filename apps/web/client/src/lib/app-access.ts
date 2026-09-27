import type { AuthUser } from "@/hooks/use-auth";
import { hasPermission, Permission } from "./permissions";

const permissions: Record<string, Permission> = {
  inbox: Permission.CONVERSATIONS_READ,
  contacts: Permission.CONTACTS_READ,
  tasks: Permission.TASKS_MANAGE,
  invoices: Permission.INVOICES_MANAGE,
  pipeline: Permission.CONTACTS_READ,
  agents: Permission.AI_USE,
  documents: Permission.FILES_READ,
};
const featureKeys: Record<string, string> = {
  inbox: "whatsapp_inbox",
  tasks: "orders",
  pipeline: "contacts",
  contacts: "contacts",
  documents: "contacts",
  invoices: "billing",
  automations: "automations",
  inventory: "orders",
  agents: "ai_assistant",
  notifications: "conversations",
  integrations: "whatsapp_inbox",
};
const minimumPlan: Record<string, string> = {
  pipeline: "STARTER",
  agents: "EMPRENDE",
};
const plans = [
  "FREE",
  "EMPRENDE",
  "STARTER",
  "GROWTH",
  "BUSINESS",
  "ENTERPRISE",
  "BUSINESS_PLUS",
];

/** Presentation only: each API endpoint must still enforce authorization. */
export function canAccessAppFeature(
  key: string,
  user: AuthUser | null,
  features?: Record<string, boolean>,
) {
  if (!user) return false;
  const permission = permissions[key];
  if (
    permission &&
    !hasPermission(user.role, permission, !!user.is_platform_admin)
  )
    return false;
  const minPlan = minimumPlan[key];
  if (minPlan && plans.indexOf(user.workspace.plan) < plans.indexOf(minPlan))
    return false;
  return features?.[featureKeys[key] ?? key] !== false;
}
