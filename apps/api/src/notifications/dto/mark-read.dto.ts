import { IsOptional, IsArray, IsString } from "class-validator";

export class MarkReadDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}
