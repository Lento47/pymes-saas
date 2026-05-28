import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class OrchestrateSupportDto {
  @IsString()
  @MaxLength(8000)
  message: string;

  @IsOptional()
  @IsString()
  diagnostic_case_id?: string;

  /** Tier 3 opt-in to allow the fix→PR branch of the pipeline. */
  @IsOptional()
  @IsBoolean()
  allow_pr_creation?: boolean;
}
