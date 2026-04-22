import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateStageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}
