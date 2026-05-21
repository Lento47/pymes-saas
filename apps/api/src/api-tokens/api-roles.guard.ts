import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./api-roles.decorator";
import { ApiRole } from "./api-token.guard";

@Injectable()
export class ApiRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<ApiRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required — allow
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // If API token authenticated, check role
    if (request.api_token_authenticated && request.api_role) {
      if (requiredRoles.includes(request.api_role)) {
        return true;
      }
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(", ")}. Current: ${request.api_role}`,
      );
    }

    // JWT authenticated users have implicit "workspace" access
    // They can access user-level endpoints but not founder-only ones
    if (request.user && !requiredRoles.includes(ApiRole.FOUNDER)) {
      return true;
    }

    // Founder endpoints require founder role
    if (requiredRoles.includes(ApiRole.FOUNDER)) {
      throw new ForbiddenException("Founder role required for this operation");
    }

    // If no JWT user and no API token, default allow (base auth guard handles)
    return true;
  }
}
