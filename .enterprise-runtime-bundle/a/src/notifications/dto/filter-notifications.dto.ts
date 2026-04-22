import { IsOptional, IsNumberString, IsIn } from 'class-validator';

export class FilterNotificationsDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  read?: string;

  @IsOptional()
  @IsNumberString()
  page?: number = 1;

  @IsOptional()
  @IsNumberString()
  limit?: number = 20;
}
