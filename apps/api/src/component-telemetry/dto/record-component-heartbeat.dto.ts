import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REPORTABLE_COMPONENT_STATUSES = ['ONLINE', 'DEGRADED'] as const;
export type ReportableComponentStatus = typeof REPORTABLE_COMPONENT_STATUSES[number];

export class RecordComponentHeartbeatDto {
  @IsIn(REPORTABLE_COMPONENT_STATUSES)
  status!: ReportableComponentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;
}
