import { IsEnum } from 'class-validator';
import { WorkspaceUserRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceUserRole)
  role: WorkspaceUserRole;
}
