import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../permissions/permission.types';

export const PERMISSIONS_METADATA_KEY = 'required_permissions';

/**
 * Require one or more granular permissions for an endpoint.
 * The user must have ALL listed permissions (AND semantics).
 *
 * Usage:
 *   @RequirePermission('can_delete_contacts')
 *   @RequirePermission('can_manage_invoices', 'can_export_data')
 */
export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
