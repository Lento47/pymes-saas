import { IsEmail, IsEnum, IsOptional } from "class-validator";
import { WorkspaceUserRole } from "@prisma/client";

export class AssignMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(WorkspaceUserRole)
  @IsOptional()
  role?: WorkspaceUserRole = WorkspaceUserRole.AGENT;
}
