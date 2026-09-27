import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class InvoiceContactsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}
