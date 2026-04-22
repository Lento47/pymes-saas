/**
 * Granular permission capabilities layered on top of workspace role.
 *
 * Hierarchy:
 *   OWNER → all permissions (always true)
 *   ADMIN → most permissions by default; can be revoked per user via overrides
 *   AGENT → limited default set; can be granted extra per user via overrides
 *   VIEWER → read-only; rarely granted extras
 *
 * Overrides are stored in `workspace_users.permissions_json` as a flat map:
 *   { "can_delete_contacts": true, "can_export_data": false }
 *
 * Missing keys fall back to the role default.
 */

export const PERMISSION_KEYS = [
  'can_delete_contacts',
  'can_export_data',
  'can_send_bulk_email',
  'can_manage_invoices',
  'can_manage_automations',
  'can_view_audit_log',
  'can_manage_billing',
  'can_manage_integrations',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  can_delete_contacts: 'Eliminar contactos',
  can_export_data: 'Exportar datos',
  can_send_bulk_email: 'Enviar campañas masivas',
  can_manage_invoices: 'Gestionar facturas',
  can_manage_automations: 'Gestionar automatizaciones',
  can_view_audit_log: 'Ver registro de auditoría',
  can_manage_billing: 'Gestionar facturación del workspace',
  can_manage_integrations: 'Gestionar integraciones y canales',
};

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  can_delete_contacts: 'Eliminar contactos de forma permanente (soft-delete no aplica).',
  can_export_data: 'Descargar exports de contactos, conversaciones o facturas.',
  can_send_bulk_email: 'Crear y enviar campañas de email a múltiples contactos.',
  can_manage_invoices: 'Crear, editar, marcar pagadas o anular facturas.',
  can_manage_automations: 'Activar o modificar reglas de automatización.',
  can_view_audit_log: 'Revisar el registro de cambios y acciones de usuarios.',
  can_manage_billing: 'Gestionar la suscripción y métodos de pago del workspace.',
  can_manage_integrations: 'Conectar o desconectar canales (WhatsApp, email, APIs).',
};

/** Default permission set per role. */
export const ROLE_DEFAULTS: Record<string, Record<PermissionKey, boolean>> = {
  OWNER: {
    can_delete_contacts: true,
    can_export_data: true,
    can_send_bulk_email: true,
    can_manage_invoices: true,
    can_manage_automations: true,
    can_view_audit_log: true,
    can_manage_billing: true,
    can_manage_integrations: true,
  },
  ADMIN: {
    can_delete_contacts: true,
    can_export_data: true,
    can_send_bulk_email: true,
    can_manage_invoices: true,
    can_manage_automations: true,
    can_view_audit_log: true,
    can_manage_billing: false, // only OWNER by default
    can_manage_integrations: true,
  },
  AGENT: {
    can_delete_contacts: false,
    can_export_data: false,
    can_send_bulk_email: false,
    can_manage_invoices: false,
    can_manage_automations: false,
    can_view_audit_log: false,
    can_manage_billing: false,
    can_manage_integrations: false,
  },
  VIEWER: {
    can_delete_contacts: false,
    can_export_data: false,
    can_send_bulk_email: false,
    can_manage_invoices: false,
    can_manage_automations: false,
    can_view_audit_log: false,
    can_manage_billing: false,
    can_manage_integrations: false,
  },
};

/**
 * Resolve the effective permission set given a role and optional overrides.
 * OWNER always returns all-true regardless of overrides.
 */
export function resolvePermissions(
  role: string,
  overrides?: Record<string, boolean> | null,
): Record<PermissionKey, boolean> {
  const defaults = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.VIEWER;
  if (role === 'OWNER') return { ...defaults };

  const resolved = { ...defaults };
  if (overrides && typeof overrides === 'object') {
    for (const key of PERMISSION_KEYS) {
      if (key in overrides && typeof overrides[key] === 'boolean') {
        resolved[key] = overrides[key];
      }
    }
  }
  return resolved;
}

/** Check a single permission. */
export function hasPermission(
  role: string,
  overrides: Record<string, boolean> | null | undefined,
  permission: PermissionKey,
): boolean {
  if (role === 'OWNER') return true;
  return resolvePermissions(role, overrides)[permission] === true;
}
