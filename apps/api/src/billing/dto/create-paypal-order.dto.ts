import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreatePaypalOrderDto {
  @IsOptional()
  @IsIn(["MEMORY_CREDITS", "AI_TOKENS"])
  purchase_type?: "MEMORY_CREDITS" | "AI_TOKENS";

  @IsOptional()
  @IsString()
  packId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  credits?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  tokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  price?: number;
}
