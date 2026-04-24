import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(8)
  password: string;

  /** Si se pasa un invite token, el usuario se une al workspace correspondiente */
  @IsOptional()
  @IsString()
  invite_token?: string;
}
