import { IsNotEmpty, IsString } from "class-validator";

export class CreatePaypalOrderDto {
  @IsNotEmpty()
  @IsString()
  packId!: string;
}
