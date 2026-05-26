import { IsArray, IsOptional, IsObject } from "class-validator";

export class UpdateBusinessMemoryDto {
  @IsOptional()
  @IsArray()
  facts_json?: unknown[];

  @IsOptional()
  @IsArray()
  policies_json?: unknown[];

  @IsOptional()
  @IsArray()
  faq_json?: unknown[];

  @IsOptional()
  @IsObject()
  tone_rules_json?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  successful_patterns_json?: unknown[];
}
