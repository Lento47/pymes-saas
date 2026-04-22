import { IsEnum } from 'class-validator';
import { WorkspaceUserRole } from '../../common/types/enums';

export class ChangeMemberRoleDto {
  @IsEnum(WorkspaceUserRole)
  role: WorkspaceUserRole;
}
