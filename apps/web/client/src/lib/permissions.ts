/**
 * Frontend permission helpers — mirrors the backend permission matrix.
 *
 * IMPORTANT: Frontend hiding is UX only. Backend always enforces permissions.
 * Never use these checks as a security gate — only for showing/hiding UI.
 */

export const Permission = {
  WORKSPACE_READ:       "workspace.read",
  WORKSPACE_UPDATE:     "workspace.update",
  MEMBERS_MANAGE:       "members.manage",
  CHANNELS_MANAGE:      "channels.manage",
  CONVERSATIONS_READ:   "conversations.read",
  CONVERSATIONS_REPLY:  "conversations.reply",
  CONVERSATIONS_ASSIGN: "conversations.assign",
  CONTACTS_READ:        "contacts.read",
  CONTACTS_MANAGE:      "contacts.manage",
  TASKS_MANAGE:         "tasks.manage",
  INVOICES_MANAGE:      "invoices.manage",
  BILLING_MANAGE:       "billing.manage",
  AI_USE:               "ai.use",
  AI_MANAGE:            "ai.manage",
  AUDIT_READ:           "audit.read",
  FILES_READ:           "files.read",
  FILES_MANAGE:         "files.manage",
  ADMIN_PLATFORM:       "admin.platform",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: Object.values(Permission).filter((p) => p !== Permission.ADMIN_PLATFORM) as Permission[],
  ADMIN: [
    Permission.WORKSPACE_READ, Permission.WORKSPACE_UPDATE,
    Permission.MEMBERS_MANAGE, Permission.CHANNELS_MANAGE,
    Permission.CONVERSATIONS_READ, Permission.CONVERSATIONS_REPLY, Permission.CONVERSATIONS_ASSIGN,
    Permission.CONTACTS_READ, Permission.CONTACTS_MANAGE,
    Permission.TASKS_MANAGE, Permission.INVOICES_MANAGE, Permission.BILLING_MANAGE,
    Permission.AI_USE, Permission.AI_MANAGE,
    Permission.AUDIT_READ, Permission.FILES_READ, Permission.FILES_MANAGE,
  ],
  MANAGER: [
    Permission.WORKSPACE_READ,
    Permission.CONVERSATIONS_READ, Permission.CONVERSATIONS_REPLY, Permission.CONVERSATIONS_ASSIGN,
    Permission.CONTACTS_READ, Permission.CONTACTS_MANAGE,
    Permission.TASKS_MANAGE, Permission.INVOICES_MANAGE,
    Permission.AI_USE, Permission.AUDIT_READ, Permission.FILES_READ, Permission.FILES_MANAGE,
  ],
  AGENT: [
    Permission.WORKSPACE_READ,
    Permission.CONVERSATIONS_READ, Permission.CONVERSATIONS_REPLY, Permission.CONVERSATIONS_ASSIGN,
    Permission.CONTACTS_READ, Permission.CONTACTS_MANAGE,
    Permission.TASKS_MANAGE, Permission.AI_USE, Permission.FILES_READ,
  ],
  BILLING: [
    Permission.WORKSPACE_READ, Permission.BILLING_MANAGE,
    Permission.INVOICES_MANAGE, Permission.AUDIT_READ,
  ],
  VIEWER: [
    Permission.WORKSPACE_READ, Permission.CONVERSATIONS_READ,
    Permission.CONTACTS_READ, Permission.FILES_READ,
  ],
};

export function hasPermission(role: string, permission: Permission, isPlatformAdmin = false): boolean {
  if (isPlatformAdmin) return true;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export function usePermissions(role: string | undefined, isPlatformAdmin = false) {
  return {
    can: (permission: Permission) =>
      role ? hasPermission(role, permission, isPlatformAdmin) : false,
    canAny: (permissions: Permission[]) =>
      permissions.some((p) => role ? hasPermission(role, p, isPlatformAdmin) : false),
    canAll: (permissions: Permission[]) =>
      permissions.every((p) => role ? hasPermission(role, p, isPlatformAdmin) : false),
  };
}
