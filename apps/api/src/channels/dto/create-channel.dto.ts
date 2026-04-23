import { IsEnum, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ChannelType } from '../../common/types/enums';

export class CreateChannelDto {
  @IsEnum(ChannelType)
  type: ChannelType;

  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsString()
  provider?: string; // 'sendgrid' | 'twilio' | 'meta' | etc.

  @IsOptional()
  @IsObject()
  config?: Record<string, any>; // secrets — se encriptan a nivel de app antes de persistir
}
