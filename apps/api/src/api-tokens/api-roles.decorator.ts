import { SetMetadata } from "@nestjs/common";
import type { ApiRole } from "./api-token.guard";

export const ROLES_KEY = "api_roles";

export const RequireApiRole = (...roles: ApiRole[]) => SetMetadata(ROLES_KEY, roles);
