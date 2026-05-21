import { IsEmail, IsEnum } from "class-validator";
import { WorkspaceUserRole } from "@prisma/client";

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsEnum(WorkspaceUserRole)
  role: WorkspaceUserRole;
}
