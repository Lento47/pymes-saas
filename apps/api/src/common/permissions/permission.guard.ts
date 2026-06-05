import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSION_KEY } from "./require-permission.decorator";
import { hasPermission, Permission } from "./permissions";
import { AuthUser } from "../../auth/strategies/jwt.strategy";

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequirePermission() → endpoint relies on JwtAuthGuard + RolesGuard only
    if (!required) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user) return false;

    const allowed = hasPermission(user.role, required, user.is_platform_admin);

    if (!allowed) {
      this.logger.warn(
        `Permission denied: user=${user.id} role=${user.role} ` +
        `workspace=${user.workspace_id} required=${required}`,
      );
      throw new ForbiddenException(
        `Permiso requerido: ${required}. Tu rol (${user.role}) no tiene acceso.`,
      );
    }

    return true;
  }
}
