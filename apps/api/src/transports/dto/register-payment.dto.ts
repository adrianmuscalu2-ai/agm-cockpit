import { IsDateString, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class RegisterPaymentDto {
  @IsNumberString()
  amount!: string;

  @IsString()
  @Length(3, 3)
  currencyCode!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
