import { IsOptional, IsString, IsNumber, Min } from "class-validator";

export class CreatePaypalOrderDto {
  @IsOptional()
  @IsString()
  packId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  credits?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  price?: number;
}
