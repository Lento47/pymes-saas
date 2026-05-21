import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FeatureFlagsService } from "./feature-flags.service";

export const REQUIRE_FEATURE = "REQUIRE_FEATURE";

export const RequireFeature = (key: string) => {
  return (target: any, propertyKey?: string, descriptor?: any) => {
    Reflect.defineMetadata(REQUIRE_FEATURE, key, descriptor?.value ?? target);
  };
};

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.get<string>(REQUIRE_FEATURE, context.getHandler());
    if (!requiredFeature) return true;

    const req = context.switchToHttp().getRequest();
    const workspaceId = req.user?.workspace_id;
    if (!workspaceId) return false;

    try {
      return await this.featureFlags.isEnabled(requiredFeature, workspaceId);
    } catch (err) {
      // If isEnabled throws (e.g., DB error), fail closed rather than 500
      return false;
    }
  }
}
