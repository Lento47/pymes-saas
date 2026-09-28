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

  /**
   * The reader confirms they are 18 or over.
   *
   * Sent as its own field rather than folded into `terms_accepted` because the two
   * answer different questions and are separately provable. Under Costa Rica's
   * Ley 8968 Art. 5 the consent has to come from the person, and a minor's consent
   * requires a representative — so "this account holder is an adult" is a
   * provenance claim about the account, not a clause inside a contract. Keeping it
   * separate is also what lets the timestamp below answer *which* assertion was made
   * and when, if a question is ever asked.
   *
   * The checkbox that sets this has existed on the web sign-up form for a while and
   * was never sent; a client can omit a field it does not know about, so the
   * assertion is enforced here rather than trusted from the form.
   */
  @IsBoolean()
  @Transform(({ value }) => value === true || value === "true")
  age_confirmed: boolean;
}
