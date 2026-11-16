import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { ACPM_KINDS, ACPM_COMPONENT_KINDS, type AcpmEvent, type AcpmKind } from '@agm/shared';
class ModelDto {
  @IsString() @Length(1,120) provider!: string;
  @IsString() @Length(1,120) name!: string;
  @IsString() @Length(1,120) version!: string;
}
class WorkloadDto {
  @IsString() @Length(1,160) equivalenceKey!: string;
  @IsString() @Length(1,120) protocolVersion!: string;
  @IsString() @Length(1,160) environment!: string;
  @Matches(/^[a-f0-9]{64}$/) configurationHash!: string;
}
class BlockDto {
  @IsIn(['JUSTIFIED','UNJUSTIFIED','UNREVIEWED']) classification!: 'JUSTIFIED' | 'UNJUSTIFIED' | 'UNREVIEWED';
  @IsString() @Length(1,1000) reason!: string;
  @IsString() @Length(1,2000) decisionRef!: string;
}
export class AppendAcpmEventDto {
  @IsUUID() eventId!: string;
  @IsString() @Length(1,160) chainId!: string;
  @IsString() @Length(1,160) mandateId!: string;
  @IsString() @Length(1,160) runId!: string;
  @IsString() @Length(1,120) componentId!: string;
  @IsIn(ACPM_COMPONENT_KINDS) componentKind!: AcpmEvent['componentKind'];
  @IsOptional() @IsString() @Length(1,120) departmentId?: string;
  @IsIn(ACPM_KINDS) kind!: AcpmKind;
  @IsInt() @Min(1) @Max(2147483647) sequence!: number;
  @IsISO8601() occurredAt!: string;
  @IsString() @Length(1,2000) evidenceRef!: string;
  @Matches(/^[a-f0-9]{64}$/) evidenceHash!: string;
  @IsOptional() @IsUUID() parentEventId?: string;
  @IsOptional() @IsString() @Length(1,120) targetComponentId?: string;
  @IsOptional() @ValidateNested() @Type(()=>BlockDto) block?: BlockDto;
  @IsOptional() @ValidateNested() @Type(()=>ModelDto) model?: ModelDto;
  @IsOptional() @ValidateNested() @Type(()=>WorkloadDto) workload?: WorkloadDto;
  @IsOptional() @IsInt() @Min(1) @Max(10000) capacity?: number;
  @IsOptional() @IsUUID() supersedesEventId?: string;
  @IsOptional() @IsString() @Length(1,1000) correctionReason?: string;
}
export { AppendAcpmEventDto as AppendAcpEventDto };
export class AcpmQueryDto {
  @IsOptional() @IsString() @Length(1,120) componentId?:string;
  @IsOptional() @IsString() @Length(1,120) kind?:string;
  @IsOptional() @IsString() @Length(1,120) departmentId?:string;
  @IsOptional() @IsISO8601() from?:string;
  @IsOptional() @IsISO8601() to?:string;
}
