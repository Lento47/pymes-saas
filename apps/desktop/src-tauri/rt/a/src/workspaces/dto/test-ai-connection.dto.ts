import { IsIn, IsOptional, IsString } from 'class-validator';

export class TestAiConnectionDto {
  @IsOptional()
  @IsIn(['openai', 'anthropic', 'gemini', 'moonshot'])
  ai_provider?: string;

  @IsOptional()
  @IsString()
  ai_model?: string;

  @IsOptional()
  @IsString()
  ai_api_key?: string;
}
