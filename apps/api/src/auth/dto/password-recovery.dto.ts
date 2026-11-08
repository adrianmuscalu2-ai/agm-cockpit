import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestPasswordRecoveryDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ConfirmPasswordRecoveryDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;

  @IsString()
  @Length(8, 72)
  password!: string;
}
