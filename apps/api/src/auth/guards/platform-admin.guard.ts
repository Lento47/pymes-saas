import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../strategies/jwt.strategy';

/**
 * PlatformAdminGuard checks that the authenticated user has the `is_platform_admin` flag set.
 *
 * Usage:
 *   @Controller('admin')
 *   @UseGuards(JwtAuthGuard, PlatformAdminGuard)
 *   export class AdminController { ... }
 *
 * Must be used AFTER JwtAuthGuard to ensure user is authenticated.
 * Throws ForbiddenException if user is not a platform admin.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user?.is_platform_admin) {
      throw new ForbiddenException('Se requiere rol de administrador de plataforma.');
    }
    return true;
  }
}
