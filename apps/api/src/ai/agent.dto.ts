import { IsString, IsOptional, IsArray } from 'class-validator';

export class AgentStreamDto {
  @IsString()
  input: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;

  @IsOptional()
  @IsArray()
  file_ids?: string[];
}
