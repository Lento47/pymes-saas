import { IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PaginationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => Math.max(1, value))
  page: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => Math.min(100, Math.max(1, value)))
  limit: number = 20;
}
