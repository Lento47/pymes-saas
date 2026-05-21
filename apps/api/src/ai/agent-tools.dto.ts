import { IsString, IsOptional, IsObject } from "class-validator";

export class AgentToolDto {
  @IsString()
  tool: string;

  @IsOptional()
  @IsObject()
  arguments?: Record<string, any>;

  @IsOptional()
  @IsString()
  workspace_slug?: string;
}
