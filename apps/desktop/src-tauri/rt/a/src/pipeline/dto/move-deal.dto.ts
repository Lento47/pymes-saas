import { IsString } from 'class-validator';

export class MoveDealDto {
  @IsString()
  stage_id: string;
}
