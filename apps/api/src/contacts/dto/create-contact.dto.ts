import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ContactType } from '@prisma/client';

export class CreateContactDto {
  @IsEnum(ContactType)
  type: ContactType = ContactType.CUSTOMER;

  @IsString()
  @Length(1, 100)
  full_name: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  company_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  external_ref?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
