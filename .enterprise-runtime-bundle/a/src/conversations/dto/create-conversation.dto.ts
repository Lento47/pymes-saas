import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateConversationDto {
  @IsString()
  channel_id: string;

  @IsOptional()
  @IsString()
  contact_id?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  subject?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority = Priority.MEDIUM;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  assigned_user_id?: string;
}
