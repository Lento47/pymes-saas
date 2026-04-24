import { IsEmail, IsEnum } from 'class-validator';
import { WorkspaceUserRole } from '../../common/types/enums';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsEnum(WorkspaceUserRole)
  role: WorkspaceUserRole;
}
