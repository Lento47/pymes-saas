import { WorkspaceUserRole } from '../../../src/common/types/enums';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsEnum(WorkspaceUserRole)
  role: WorkspaceUserRole;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  department_ids?: string[];
}
