import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceUserRole } from '../../../src/common/types/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../strategies/jwt.strategy';

/** Jerarquía de roles: índice mayor = más permisos */
const ROLE_HIERARCHY: WorkspaceUserRole[] = [
  WorkspaceUserRole.VIEWER,
  WorkspaceUserRole.AGENT,
  WorkspaceUserRole.ADMIN,
  WorkspaceUserRole.OWNER,
];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceUserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin @Roles() → el endpoint solo requiere JWT válido
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user) return false;

    const userLevel = ROLE_HIERARCHY.indexOf(user.role as WorkspaceUserRole);
    const hasAccess = requiredRoles.some(
      (role) => userLevel >= ROLE_HIERARCHY.indexOf(role),
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Se requiere rol: ${requiredRoles.join(' o ')}`,
      );
    }

    return true;
  }
}
