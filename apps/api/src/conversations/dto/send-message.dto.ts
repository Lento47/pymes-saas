import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { MessageDirection } from '@prisma/client';

export class SendMessageDto {
  @IsOptional()
  @IsEnum(MessageDirection)
  direction?: MessageDirection = MessageDirection.OUTBOUND;

  @IsOptional()
  @IsString()
  body_text?: string;

  @IsOptional()
  @IsString()
  body_html?: string;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsObject()
  template_variables?: Record<string, string>;

  @IsOptional()
  @IsString()
  media_url?: string;

  @IsOptional()
  @IsString()
  media_type?: string;
}
