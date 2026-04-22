import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MessageDirection } from '../../../src/common/types/enums';

export class SendMessageDto {
  @IsOptional()
  @IsEnum(MessageDirection)
  direction?: MessageDirection = MessageDirection.OUTBOUND;

  @IsOptional()
  @IsString()
  body_text?: string;

  @IsOptional()
  @IsString()
  body_html?: string;
}
