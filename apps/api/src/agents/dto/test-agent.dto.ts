import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { AgentChannelScope } from "@prisma/client";

export class TestAgentDto {
  @IsString()
  @MaxLength(2000)
  question: string;

  @IsOptional()
  @IsEnum(AgentChannelScope)
  channel?: AgentChannelScope;

  @IsOptional()
  @IsString()
  flowise_session_id?: string;
}
