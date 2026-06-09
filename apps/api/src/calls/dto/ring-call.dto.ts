import { IsIn, IsOptional, IsString } from "class-validator";

export class RingCallDto {
  @IsString()
  to_user_id: string;

  @IsIn(["audio", "video"])
  type: "audio" | "video";

  @IsOptional()
  @IsString()
  conversation_id?: string;
}
