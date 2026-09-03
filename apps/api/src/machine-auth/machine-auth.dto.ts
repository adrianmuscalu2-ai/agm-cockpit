import { Equals, IsInt, IsNotEmpty, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MACHINE_AUTH_CONTRACT } from './machine-auth.contract';

export class ProvisionMachineIdentityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  subject!: string;

  @IsInt()
  @Min(1)
  @Max(MACHINE_AUTH_CONTRACT.maximumCredentialLifetimeDays)
  expiresInDays: number = MACHINE_AUTH_CONTRACT.defaultCredentialLifetimeDays;
}

export class RotateMachineCredentialDto {
  @IsInt()
  @Min(1)
  @Max(MACHINE_AUTH_CONTRACT.maximumCredentialLifetimeDays)
  expiresInDays: number = MACHINE_AUTH_CONTRACT.defaultCredentialLifetimeDays;
}

export class RevokeMachineCredentialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  reason!: string;
}

export class MachineTokenRequestDto {
  @Equals('client_credentials')
  grant_type!: 'client_credentials';

  @IsUUID()
  client_id!: string;

  @IsString()
  @MinLength(64)
  @MaxLength(256)
  client_secret!: string;
}
