import { IsNumber, IsString } from "class-validator";

export class IceCandidateDto {
  @IsString()
  candidate: string;

  @IsString()
  sdp_mid: string;

  @IsNumber()
  sdp_m_line_index: number;
}
