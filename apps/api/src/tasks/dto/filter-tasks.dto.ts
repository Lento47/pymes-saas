import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Priority, TaskStatus, TaskSource } from '../../common/types/enums';

export class FilterTasksDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(TaskSource)
  source?: TaskSource;

  @IsOptional()
  @IsString()
  assigned_user_id?: string;

  @IsOptional()
  @IsString()
  contact_id?: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;

  /** Filtrar tareas vencidas: overdue=true */
  @IsOptional()
  @IsString()
  overdue?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: string;
}
