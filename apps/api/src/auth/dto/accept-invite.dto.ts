import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
  })
  password?: string;
}
