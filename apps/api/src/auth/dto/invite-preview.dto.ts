import { IsString } from 'class-validator';

export class InvitePreviewDto {
  @IsString()
  token: string;
}
