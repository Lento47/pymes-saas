import { SetMetadata } from '@nestjs/common';
import { WorkspaceUserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decora un endpoint con los roles mínimos requeridos.
 *
 * @example
 * @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
 * @Roles(WorkspaceUserRole.OWNER)
 */
export const Roles = (...roles: WorkspaceUserRole[]) =>
  SetMetadata(ROLES_KEY, roles);
