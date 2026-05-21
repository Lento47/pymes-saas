import { IsOptional, IsIn } from "class-validator";
import { Type } from "class-transformer";

export class FilterNotificationsDto {
  @IsOptional()
  @IsIn(["true", "false"])
  read?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
