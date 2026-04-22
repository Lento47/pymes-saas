import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  companyName?: string;
}

export class SetupStatusDto {
  setupComplete: boolean;
}
