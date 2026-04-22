import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  HaciendaStatus,
  InvoiceDocumentType,
  InvoiceIssuanceMode,
  InvoiceStatus,
} from '@prisma/client';

export class FilterInvoicesDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsEnum(HaciendaStatus)
  hacienda_status?: HaciendaStatus;

  @IsOptional()
  @IsEnum(InvoiceDocumentType)
  document_type?: InvoiceDocumentType;

  @IsOptional()
  @IsEnum(InvoiceIssuanceMode)
  issuance_mode?: InvoiceIssuanceMode;

  @IsOptional()
  @IsString()
  contact_id?: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  overdue_only?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
