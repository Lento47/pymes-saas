import { IsEmail, IsString, MinLength, IsOptional, IsNumber, Min } from 'class-validator';

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

export class SavePortsDto {
  @IsNumber()
  @Min(1024, { message: 'Port must be greater than 1024' })
  apiPort: number;

  @IsNumber()
  @Min(1024, { message: 'Port must be greater than 1024' })
  webPort: number;
}
