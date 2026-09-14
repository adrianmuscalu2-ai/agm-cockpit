import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { GuardianAuthorityState } from './permission-guardian.contract';

export class PermissionGuardianRequestDto {
  @IsIn(['REQUEST', 'EXECUTION', 'OBSERVATION']) phase!: 'REQUEST' | 'EXECUTION' | 'OBSERVATION';
  @IsString() @IsNotEmpty() @MaxLength(80) requestedCapability!: string;
  @IsString() @IsNotEmpty() @MaxLength(240) requestedPermissionOrScope!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) requestor!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string;
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) risk!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  @IsIn(['AUTHORIZED', 'DENIED', 'REVOKED', 'NOT_REQUIRED', 'NOT_PROVEN', 'UNAVAILABLE']) currentAuthority!: GuardianAuthorityState;
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!: string;
}
