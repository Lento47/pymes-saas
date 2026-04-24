import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  notes?: string[];
}
