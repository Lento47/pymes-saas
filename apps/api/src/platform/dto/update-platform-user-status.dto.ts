import { IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdatePlatformUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
