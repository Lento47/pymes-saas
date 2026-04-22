import { IsString, IsOptional } from 'class-validator';

export class CreateStageDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;
}
