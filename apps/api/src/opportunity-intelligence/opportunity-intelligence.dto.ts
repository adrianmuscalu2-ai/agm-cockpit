import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class IntakeOpportunityDto {
  @IsString() @MaxLength(180) idempotencyKey!: string;
  @IsIn(['email','whatsapp','webhook','manual','platform-api']) channel!: string;
  @IsString() @MaxLength(80) provider!: string;
  @IsOptional() @IsString() @MaxLength(180) platformReference?: string;
  @IsOptional() @IsString() @MaxLength(180) sourceOpportunityId?: string;
  @IsOptional() @IsString() @MaxLength(120) platform?: string;
  @IsOptional() @IsString() @MaxLength(240) pickupLocation?: string;
  @IsOptional() @IsString() @MaxLength(240) deliveryLocation?: string;
  @IsOptional() @IsDateString() pickupWindowStart?: string;
  @IsOptional() @IsDateString() pickupWindowEnd?: string;
  @IsOptional() @IsDateString() deliveryWindowStart?: string;
  @IsOptional() @IsDateString() deliveryWindowEnd?: string;
  @IsOptional() @IsNumber() priceAmount?: number;
  @IsOptional() @IsString() @MaxLength(3) currencyCode?: string;
  @IsOptional() @IsInt() @Min(0) declaredKm?: number;
  @IsOptional() @IsString() @MaxLength(120) vehicleType?: string;
  @IsOptional() @IsString() @MaxLength(32) vin?: string;
  @IsOptional() @IsString() @MaxLength(32) registration?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) conditions?: string[];
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsDateString() sourceTimestamp!: string;
  @IsOptional() @IsObject() rawPayload?: Record<string, unknown>;
  @IsOptional() @IsBoolean() retainRawPayload?: boolean;
}

export class RouteTollDto {
  @IsString() @MaxLength(160) label!: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() @MaxLength(3) currencyCode?: string;
}

export class AuthorityProofDto {
  @IsString() leaseId!: string;
  @IsInt() @Min(1) epoch!: number;
  @IsInt() @Min(1) fencingToken!: number;
}

export class RoutePlanDto {
  @IsInt() @Min(1) distanceKm!: number;
  @IsInt() @Min(1) durationMinutes!: number;
  @IsInt() @Min(0) distanceToPickupKm!: number;
  @IsOptional() @IsInt() @Min(0) repositionKm?: number;
  @IsOptional() @IsInt() @Min(0) repositionMinutes?: number;
  @IsOptional() @IsInt() @Min(0) availableGapMinutes?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) mobilityModes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => RouteTollDto) tolls?: RouteTollDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) restrictions?: string[];
  @IsOptional() @IsInt() @Min(0) finalHomeDistanceKm?: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true }) sources!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) assumptions?: string[];
  @IsInt() @Min(0) @Max(100) confidence!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) warnings?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(1440) validForMinutes?: number;
}

export class CostPlanDto {
  @IsOptional() @IsNumber() @Min(0) fuel?: number;
  @IsOptional() @IsNumber() @Min(0) train?: number;
  @IsOptional() @IsNumber() @Min(0) bus?: number;
  @IsOptional() @IsNumber() @Min(0) taxi?: number;
  @IsOptional() @IsNumber() @Min(0) tolls?: number;
  @IsOptional() @IsNumber() @Min(0) accommodation?: number;
  @IsOptional() @IsNumber() @Min(0) otherReposition?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) assumptions?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(1440) validForMinutes?: number;
}

export class OpportunitySegmentDto {
  @IsString() opportunityId!: string;
  @ValidateNested() @Type(() => RoutePlanDto) route!: RoutePlanDto;
  @ValidateNested() @Type(() => CostPlanDto) cost!: CostPlanDto;
}

export class OpportunityVariantDto {
  @IsString() @MaxLength(180) variantKey!: string;
  @IsOptional() @IsString() @MaxLength(80) objective?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => OpportunitySegmentDto) segments!: OpportunitySegmentDto[];
}

export class AnalyzeOpportunityDto {
  @IsString() @MaxLength(180) idempotencyKey!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => OpportunityVariantDto) variants!: OpportunityVariantDto[];
  @ValidateNested() @Type(() => AuthorityProofDto) routeAuthority!: AuthorityProofDto;
  @ValidateNested() @Type(() => AuthorityProofDto) costAuthority!: AuthorityProofDto;
  @ValidateNested() @Type(() => AuthorityProofDto) plannerAuthority!: AuthorityProofDto;
  @ValidateNested() @Type(() => AuthorityProofDto) judgeAuthority!: AuthorityProofDto;
}

export class DecideOpportunityDto {
  @IsString() @MaxLength(180) decisionKey!: string;
  @IsIn(['ACCEPT','REJECT']) decision!: 'ACCEPT'|'REJECT';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
