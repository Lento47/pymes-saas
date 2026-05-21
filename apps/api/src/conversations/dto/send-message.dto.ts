import { IsEnum, IsOptional, IsString, IsBoolean, IsInt, IsArray, IsObject } from "class-validator";
import { MessageDirection } from "@prisma/client";

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

  // ── Media fields ──
  @IsOptional()
  @IsString()
  media_url?: string;

  @IsOptional()
  @IsString()
  media_type?: string;

  @IsOptional()
  @IsString()
  media_mime_type?: string;

  @IsOptional()
  @IsString()
  media_filename?: string;

  @IsOptional()
  @IsString()
  media_caption?: string;

  @IsOptional()
  @IsInt()
  media_size_bytes?: number;

  @IsOptional()
  @IsArray()
  attachments?: Record<string, any>[];

  // ── Provider ──
  @IsOptional()
  @IsString()
  provider?: string;

  // ── Reply context ──
  @IsOptional()
  @IsString()
  reply_to_message_id?: string;

  // ── Interactive ──
  @IsOptional()
  @IsObject()
  interactive?: Record<string, any>;
}
