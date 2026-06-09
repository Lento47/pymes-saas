import { SetMetadata } from "@nestjs/common";
import { Permission } from "./permissions";

export const PERMISSION_KEY = "required_permission";

/** Decorator: specify the permission required to access an endpoint. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
