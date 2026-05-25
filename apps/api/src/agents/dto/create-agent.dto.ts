import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { AgentChannelScope, AgentProvider } from "@prisma/client";

export class CreateAgentDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  chatflow_id?: string;

  @IsOptional()
  @IsString()
  system_instructions?: string;

  @IsOptional()
  @IsEnum(AgentProvider)
  provider?: AgentProvider;

  @IsOptional()
  @IsEnum(AgentChannelScope)
  channel_scope?: AgentChannelScope;

  @IsOptional()
  config_json?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  template_id?: string;
}
