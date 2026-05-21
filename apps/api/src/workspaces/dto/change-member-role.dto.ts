import { IsEnum } from "class-validator";
import { WorkspaceUserRole } from "@prisma/client";

export class ChangeMemberRoleDto {
  @IsEnum(WorkspaceUserRole)
  role: WorkspaceUserRole;
}
