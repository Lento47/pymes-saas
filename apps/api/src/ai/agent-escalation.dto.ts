import { IsString, IsOptional, IsEnum, IsObject } from "class-validator";
import { Priority } from "@prisma/client";

export class CreateEscalationDto {
  @IsString()
  summary: string;

  @IsOptional()
  @IsEnum(Priority)
  severity?: Priority;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, any>;
}
