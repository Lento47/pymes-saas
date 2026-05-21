import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, IsIn } from "class-validator";
import { Type } from "class-transformer";

export class CreateProductDto {
  @IsOptional()
  @IsString()
  category_id?: string;

  @IsString()
  name: string;

  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(["PRODUCT", "SERVICE"])
  type?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  current_stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_stock?: number;

  @IsOptional()
  @IsString()
  unit_of_measure?: string;

  @IsOptional()
  @IsBoolean()
  track_inventory?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
