import { IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{12,}$/, {
    message: 'La contraseña debe contener mayúscula, minúscula, número y carácter especial',
  })
  password?: string;
}
