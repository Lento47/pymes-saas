import { IsEnum } from 'class-validator';
import { WorkspaceUserRole } from '../../common/types/enums';

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceUserRole)
  role: WorkspaceUserRole;
}
