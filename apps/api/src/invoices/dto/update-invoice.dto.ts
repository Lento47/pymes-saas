import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Length,
} from 'class-validator';
import {
  HaciendaStatus,
  InvoiceDocumentType,
  InvoiceIssuanceMode,
  InvoiceStatus,
} from '@prisma/client';
import { InvoiceLineDto } from './invoice-line.dto';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  contact_id?: string;

  @IsOptional()
  @IsString()
  conversation_id?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  number?: string;

  @IsOptional()
  @IsEnum(InvoiceDocumentType)
  document_type?: InvoiceDocumentType;

  @IsOptional()
  @IsEnum(InvoiceIssuanceMode)
  issuance_mode?: InvoiceIssuanceMode;

  @IsOptional()
  @IsEnum(HaciendaStatus)
  hacienda_status?: HaciendaStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  subtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  tax_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  tax_amount?: number;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  currency?: string;

  @IsOptional()
  @IsString()
  due_date?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  issue_date?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  sale_condition?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  payment_method?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  activity_code?: string;

  @IsOptional()
  @IsString()
  reference_invoice_id?: string | null;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 5 })
  exchange_rate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];

  @IsOptional()
  @IsArray()
  notes?: unknown[];
}
