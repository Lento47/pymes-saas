import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator } from "@nestjs/common";
import type { AuthUser } from "../strategies/jwt.strategy";

/**
 * Extrae el usuario autenticado del request.
 *
 * @example
 * findAll(@CurrentUser() user: AuthUser) { ... }
 * getWorkspaceId(@CurrentUser('workspace_id') workspaceId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser = request.user;
    return field ? user?.[field] : user;
  },
);
