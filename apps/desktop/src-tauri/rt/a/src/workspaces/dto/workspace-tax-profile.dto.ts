import { IsOptional, IsString, Length } from 'class-validator';

export class WorkspaceTaxProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 2)
  identification_type?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  identification_number?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  legal_name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  trade_name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  activity_code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  province?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  canton?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  district?: string;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  address_detail?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  tax_email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  phone?: string;
}
