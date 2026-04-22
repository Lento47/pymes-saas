import { IsEmail, IsEnum } from 'class-validator';
import { WorkspaceUserRole } from '../../../src/common/types/enums';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsEnum(WorkspaceUserRole)
  role: WorkspaceUserRole;
}
