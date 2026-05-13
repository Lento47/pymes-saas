import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  Length,
} from 'class-validator';
import {
  HaciendaStatus,
  InvoiceDocumentType,
  InvoiceIssuanceMode,
} from '@prisma/client';
import { InvoiceLineDto } from './invoice-line.dto';

export class CreateInvoiceDto {
  @IsString()
  contact_id: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;

  @IsString()
  @Length(1, 50)
  number: string;

  @IsOptional()
  @IsEnum(InvoiceDocumentType)
  document_type?: InvoiceDocumentType;

  @IsOptional()
  @IsEnum(InvoiceIssuanceMode)
  issuance_mode?: InvoiceIssuanceMode;

  @IsOptional()
  @IsEnum(HaciendaStatus)
  hacienda_status?: HaciendaStatus;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

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
  @Transform(({ value }) => (value === '' ? undefined : value))
  currency?: string;

  @IsString()
  due_date: string;

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
  @Transform(({ value }) => (value === '' ? undefined : value))
  activity_code?: string;

  @IsOptional()
  @IsString()
  reference_invoice_id?: string;

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
