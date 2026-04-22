import { IsString, IsOptional, MaxLength, IsHexColor } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  color?: string; // hex, e.g. #4f8ef7
}
