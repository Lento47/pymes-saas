/**
 * Frontend permission helpers — mirrors the backend permission matrix.
 *
 * IMPORTANT: Frontend hiding is UX only. Backend always enforces permissions.
 * Never use these checks as a security gate — only for showing/hiding UI.
 *
 * ## Why "mirrors" is a hard requirement and not a description
 *
 * This file is a second, hand-maintained copy of
 * `apps/api/src/common/permissions/permissions.ts`. Nothing in the type system ties the
 * two together, so a permission added on one side and forgotten on the other compiles
 * cleanly and fails silently. It fails in two directions, and they are opposite bugs:
 *
 * - **Missing here, present in the API.** `hasPermission` answers `false` for something
 *   the person is entitled to, so a real capability is hidden from the UI. This is the
 *   state `CALLS_INITIATE` was in: absent from the constant entirely, so it was absent
 *   from every role, and `hasPermission(role, "calls.initiate")` was `false` for every
 *   role including `OWNER`. A permission that no role can hold is not a UI decision, it
 *   is a capability the frontend can never surface.
 * - **Present here, absent in the API.** `hasPermission` answers `true` for something the
 *   API will refuse, so the UI offers a control guaranteed to fail on click. This is the
 *   more damaging direction, because it looks like a working feature until someone
 *   presses it.
 *
 * `permissions.parity.test.ts` is the guard. It imports the API's map and asserts this
 * file matches it exactly, in both directions — so the next drift fails a test instead
 * of a support ticket. `OWNER` is derived from `Object.values(Permission)` here, exactly
 * as the API derives it, so `OWNER` cannot drift while the constant is in sync; the five
 * hand-written lists are the ones that can, and the test covers all six.
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
  CALLS_INITIATE:       "calls.initiate",
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
    Permission.AI_USE, Permission.AI_MANAGE, Permission.CALLS_INITIATE,
    Permission.AUDIT_READ, Permission.FILES_READ, Permission.FILES_MANAGE,
  ],
  MANAGER: [
    Permission.WORKSPACE_READ,
    Permission.CONVERSATIONS_READ, Permission.CONVERSATIONS_REPLY, Permission.CONVERSATIONS_ASSIGN,
    Permission.CONTACTS_READ, Permission.CONTACTS_MANAGE,
    Permission.TASKS_MANAGE, Permission.INVOICES_MANAGE,
    Permission.AI_USE, Permission.CALLS_INITIATE,
    Permission.AUDIT_READ, Permission.FILES_READ, Permission.FILES_MANAGE,
  ],
  AGENT: [
    Permission.WORKSPACE_READ,
    Permission.CONVERSATIONS_READ, Permission.CONVERSATIONS_REPLY, Permission.CONVERSATIONS_ASSIGN,
    Permission.CONTACTS_READ, Permission.CONTACTS_MANAGE,
    Permission.TASKS_MANAGE, Permission.AI_USE, Permission.CALLS_INITIATE, Permission.FILES_READ,
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
