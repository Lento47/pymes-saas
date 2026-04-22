import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decora un endpoint con los roles mínimos requeridos.
 *
 * @example
 * @Roles('ADMIN', 'OWNER')
 * @Roles('OWNER')
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
