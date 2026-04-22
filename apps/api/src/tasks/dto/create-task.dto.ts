import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Priority, TaskSource } from '../../../src/common/types/enums';

export class CreateTaskDto {
  @IsString()
  @Length(1, 255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority = Priority.MEDIUM;

  @IsOptional()
  @IsEnum(TaskSource)
  source?: TaskSource = TaskSource.MANUAL;

  @IsOptional()
  @IsString()
  assigned_user_id?: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;

  @IsOptional()
  @IsString()
  contact_id?: string;

  @IsOptional()
  @IsDateString()
  due_at?: string;
}
