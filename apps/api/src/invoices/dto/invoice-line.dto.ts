import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class InvoiceLineDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  line_number?: number;

  @IsString()
  @Length(1, 500)
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 5 })
  unit_price: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 5 })
  discount_amount?: number;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  cabys_code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  unit_of_measure?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  tax_code?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  tax_rate?: number;

  @IsOptional()
  @IsObject()
  exoneration?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  metadata?: unknown[];

  @IsOptional()
  @IsString()
  product_id?: string;
}
