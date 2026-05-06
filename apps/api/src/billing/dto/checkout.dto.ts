import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  priceId: string;
}
