import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../strategies/jwt.strategy';

const ROLE_HIERARCHY = ['VIEWER', 'AGENT', 'ADMIN', 'OWNER'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user) return false;

    const userLevel = ROLE_HIERARCHY.indexOf(user.role);
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
