import { IsString, IsOptional, IsObject } from "class-validator";

export class RecordFeedbackDto {
  @IsString()
  event_type!: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;

  @IsOptional()
  @IsString()
  message_id?: string;

  @IsOptional()
  @IsString()
  contact_id?: string;

  @IsOptional()
  @IsObject()
  original_json?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  corrected_json?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outcome_json?: Record<string, unknown>;
}
