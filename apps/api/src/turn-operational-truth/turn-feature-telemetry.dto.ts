import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const TURN_BASIC_FEATURE_IDS = [
  'basic.transport-document', 'basic.tachograph', 'basic.dashboard-text',
  'basic.dashboard-warning', 'basic.legislation', 'basic.cargo-safety', 'basic.ocr-workspace',
] as const;

export class RecordTurnFeatureTelemetryDto {
  @IsIn(TURN_BASIC_FEATURE_IDS) featureId!: typeof TURN_BASIC_FEATURE_IDS[number];
  @IsIn(['SUCCESS', 'UNCERTAIN', 'FAILED', 'NO_TEXT']) outcome!: 'SUCCESS' | 'UNCERTAIN' | 'FAILED' | 'NO_TEXT';
  @IsInt() @Min(0) @Max(3_600_000) durationMs!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) confidence?: number;
  @IsOptional() @IsString() @MaxLength(32) resultStatus?: string;
}
