import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const carMoverProtocolTypes = ['TAKEOVER', 'HANDOVER'] as const;
export type CarMoverProtocolType = typeof carMoverProtocolTypes[number];

export class RecordCarMoverProtocolDto {
  @IsIn(carMoverProtocolTypes) protocolType!: CarMoverProtocolType;
  @IsInt() @Min(0) odometerKm!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) energyPercent?: number;
  @IsInt() @Min(0) @Max(20) keyCount!: number;
  @IsOptional() @IsString() @MaxLength(1000) conditionNotes?: string;
  @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) photoDigests!: string[];
}
