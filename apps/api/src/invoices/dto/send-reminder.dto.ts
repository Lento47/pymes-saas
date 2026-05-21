import { IsOptional, IsString } from "class-validator";

export class SendReminderDto {
  @IsString()
  channel_id: string;

  @IsOptional()
  @IsString()
  draft_text?: string;
}
