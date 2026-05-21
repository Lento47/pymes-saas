import { IsString, IsOptional, IsBoolean } from "class-validator";

export class AddMemberDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsBoolean()
  is_lead?: boolean;
}
