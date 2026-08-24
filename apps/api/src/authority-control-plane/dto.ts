import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class ResourceSelectorDto {
  @IsOptional() @IsString() @MaxLength(48) productId?: string;
  @IsOptional() @IsString() @MaxLength(80) moduleId?: string;
  @IsOptional() @IsString() @MaxLength(80) subjectType?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) subjectIds?: string[];
}

export class CreateMandateDto {
  @IsString() @MaxLength(160) mandateKey!: string;
  @IsString() @MaxLength(180) scopeId!: string;
  @IsString() @MaxLength(160) agentId!: string;
  @IsIn(['EXECUTIVE', 'ADVISORY', 'INSPECTOR']) mode!: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) readSet!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) writeSet!: string[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ResourceSelectorDto) resourceSelectors!: ResourceSelectorDto[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) prohibitedActions!: string[];
  @IsOptional() @IsString() expiresAt?: string;
}

export class CreateDecisionDto {
  @IsString() @MaxLength(160) decisionKey!: string;
  @IsString() mandateId!: string;
  @IsString() @MaxLength(120) actionType!: string;
  @IsOptional() @IsString() @MaxLength(240) proposalRef?: string;
  @IsOptional() @IsString() @MaxLength(80) subjectType?: string;
  @IsOptional() @IsString() @MaxLength(180) subjectId?: string;
  @IsObject() decision!: Record<string, unknown>;
}

export class IssueLeaseDto {
  @IsString() @MaxLength(180) leaseKey!: string;
  @IsString() @MaxLength(180) requestId!: string;
  @IsString() mandateId!: string;
  @IsOptional() @IsString() decisionId?: string;
  @IsString() @MaxLength(120) providerId!: string;
  @IsInt() @Min(1) ttlSeconds!: number;
}

export class HandoffLeaseDto extends IssueLeaseDto {
  @IsString() previousLeaseId!: string;
  @IsString() @MaxLength(240) reason!: string;
}

export class ValidateWriteDto {
  @IsString() leaseId!: string;
  @IsInt() @Min(1) epoch!: number;
  @IsInt() @Min(1) fencingToken!: number;
  @IsString() @MaxLength(120) command!: string;
  @IsString() @MaxLength(180) scopeId!: string;
  @IsOptional() @ValidateNested() @Type(() => ResourceSelectorDto) resource?: ResourceSelectorDto;
}

export class RevokeLeaseDto {
  @IsString() @MaxLength(240) reason!: string;
}

export class ExecuteRecoveryDto {
  @IsString() @MaxLength(180) executionKey!: string;
  @IsString() runbookId!: string;
  @IsString() mandateId!: string;
  @IsString() decisionId!: string;
  @IsString() authorityLeaseId!: string;
  @IsInt() @Min(1) fencingToken!: number;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) actions!: string[];
}

export class AssessAuthorityGateDto {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) baselineEvidenceRefs!: string[];
}
