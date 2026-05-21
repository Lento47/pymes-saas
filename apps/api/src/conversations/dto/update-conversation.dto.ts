import { IsEnum, IsOptional, IsString } from "class-validator";
import { ConversationStatus, Priority } from "@prisma/client";

export class UpdateConversationDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  assigned_user_id?: string;

  @IsOptional()
  @IsString()
  contact_id?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}
