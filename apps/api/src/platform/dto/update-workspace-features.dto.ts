import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateWorkspaceFeaturesDto {
  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  beta_profile?: string | null;

  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  limits?: Record<string, number>;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
