import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class BusinessProfileDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  categories: string[];

  @IsString()
  team_size: string;

  @IsArray()
  @IsString({ each: true })
  channels: string[];

  @IsArray()
  @IsString({ each: true })
  needs: string[];
}
