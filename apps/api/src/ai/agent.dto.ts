import { IsString, IsOptional, IsArray } from "class-validator";

export class AgentStreamDto {
  @IsOptional()
  @IsString()
  input?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsArray()
  file_ids?: string[];
}
