/**
 * PymesHub Permission System
 *
 * Explicit permission constants + role-to-permission mapping.
 * Backend always enforces permissions. Frontend may hide UI elements,
 * but that is UX only — backend is the source of truth.
 */

export const Permission = {
  // Workspace
  WORKSPACE_READ:      "workspace.read",
  WORKSPACE_UPDATE:    "workspace.update",

  // Members
  MEMBERS_MANAGE:      "members.manage",

  // Channels
  CHANNELS_MANAGE:     "channels.manage",

  // Conversations
  CONVERSATIONS_READ:   "conversations.read",
  CONVERSATIONS_REPLY:  "conversations.reply",
  CONVERSATIONS_ASSIGN: "conversations.assign",

  // Contacts
  CONTACTS_READ:        "contacts.read",
  CONTACTS_MANAGE:      "contacts.manage",

  // Tasks
  TASKS_MANAGE:         "tasks.manage",

  // Invoices
  INVOICES_MANAGE:      "invoices.manage",

  // Billing
  BILLING_MANAGE:       "billing.manage",

  // AI
  AI_USE:               "ai.use",
  AI_MANAGE:            "ai.manage",

  // Audit
  AUDIT_READ:           "audit.read",

  // Files
  FILES_READ:           "files.read",
  FILES_MANAGE:         "files.manage",

  // Platform admin (cross-workspace)
  ADMIN_PLATFORM:       "admin.platform",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// ── Role → permission mapping ─────────────────────────────────────────────────
// Each role receives a set of permissions. Roles are not hierarchical here —
// each has an explicit grant list so additions never silently expand scope.

const OWNER_PERMISSIONS: Permission[] = Object.values(Permission).filter(
  (p) => p !== Permission.ADMIN_PLATFORM,
) as Permission[];

const ADMIN_PERMISSIONS: Permission[] = [
  Permission.WORKSPACE_READ,
  Permission.WORKSPACE_UPDATE,
  Permission.MEMBERS_MANAGE,
  Permission.CHANNELS_MANAGE,
  Permission.CONVERSATIONS_READ,
  Permission.CONVERSATIONS_REPLY,
  Permission.CONVERSATIONS_ASSIGN,
  Permission.CONTACTS_READ,
  Permission.CONTACTS_MANAGE,
  Permission.TASKS_MANAGE,
  Permission.INVOICES_MANAGE,
  Permission.BILLING_MANAGE,
  Permission.AI_USE,
  Permission.AI_MANAGE,
  Permission.AUDIT_READ,
  Permission.FILES_READ,
  Permission.FILES_MANAGE,
];

const MANAGER_PERMISSIONS: Permission[] = [
  Permission.WORKSPACE_READ,
  Permission.CONVERSATIONS_READ,
  Permission.CONVERSATIONS_REPLY,
  Permission.CONVERSATIONS_ASSIGN,
  Permission.CONTACTS_READ,
  Permission.CONTACTS_MANAGE,
  Permission.TASKS_MANAGE,
  Permission.INVOICES_MANAGE,
  Permission.AI_USE,
  Permission.AUDIT_READ,
  Permission.FILES_READ,
  Permission.FILES_MANAGE,
];

const AGENT_PERMISSIONS: Permission[] = [
  Permission.WORKSPACE_READ,
  Permission.CONVERSATIONS_READ,
  Permission.CONVERSATIONS_REPLY,
  Permission.CONVERSATIONS_ASSIGN,
  Permission.CONTACTS_READ,
  Permission.CONTACTS_MANAGE,
  Permission.TASKS_MANAGE,
  Permission.AI_USE,
  Permission.FILES_READ,
];

const BILLING_PERMISSIONS: Permission[] = [
  Permission.WORKSPACE_READ,
  Permission.BILLING_MANAGE,
  Permission.INVOICES_MANAGE,
  Permission.AUDIT_READ,
];

const VIEWER_PERMISSIONS: Permission[] = [
  Permission.WORKSPACE_READ,
  Permission.CONVERSATIONS_READ,
  Permission.CONTACTS_READ,
  Permission.FILES_READ,
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER:   OWNER_PERMISSIONS,
  ADMIN:   ADMIN_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  AGENT:   AGENT_PERMISSIONS,
  BILLING: BILLING_PERMISSIONS,
  VIEWER:  VIEWER_PERMISSIONS,
};

/**
 * Returns true if the given role has the given permission.
 * Platform admins bypass all workspace permission checks.
 */
export function hasPermission(
  role: string,
  permission: Permission,
  isPlatformAdmin = false,
): boolean {
  if (isPlatformAdmin) return true;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
