import { IsEmail, IsString, MinLength, IsOptional, Matches, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @Matches(/^[\w\s-]{2,100}$/, {
    message: "Name contains invalid characters",
  })
  name: string;

  @IsString()
  @MinLength(12, { message: "Password must be at least 12 characters" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{12,}$/, {
    message: "Password must contain uppercase, lowercase, number, and special character",
  })
  password: string;

  /** Si se pasa un invite token, el usuario se une al workspace correspondiente */
  @IsOptional()
  @IsString()
  invite_token?: string;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === "true")
  terms_accepted: boolean;
}
