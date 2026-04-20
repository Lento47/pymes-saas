import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  contact_id: string;

  @IsString()
  @Length(1, 50)
  number: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  currency?: string;

  @IsString()
  due_date: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  notes?: unknown[];
}
