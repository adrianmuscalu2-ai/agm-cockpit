import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { TOLL_REQUIRED_REASONS, type TollRequiredReason } from './live-adapter.contracts';

export class CoordinatesDto {@IsNumber() latitude!:number;@IsNumber() longitude!:number;}
export class GeocodeLiveDto {@IsString() @MaxLength(400) query!:string;@IsOptional() @IsArray() @IsString({each:true}) countrySet?:string[];@IsOptional() @IsBoolean() forceRefresh?:boolean;}
export class RouteLiveDto {@ValidateNested() @Type(()=>CoordinatesDto) origin!:CoordinatesDto;@ValidateNested() @Type(()=>CoordinatesDto) destination!:CoordinatesDto;@IsOptional() @IsDateString() departureTime?:string;@IsOptional() @IsObject() vehicle?:Record<string,unknown>;@IsOptional() @IsBoolean() forceRefresh?:boolean;}
export class TrafficLiveDto {@ValidateNested() @Type(()=>CoordinatesDto) origin!:CoordinatesDto;@ValidateNested() @Type(()=>CoordinatesDto) destination!:CoordinatesDto;@IsOptional() @IsBoolean() forceRefresh?:boolean;}
export class TollLiveDto extends TrafficLiveDto {@IsString() @MaxLength(240) routeReference!:string;@IsBoolean() tollRequired!:boolean;@ValidateIf((value:TollLiveDto)=>value.tollRequired) @IsIn(TOLL_REQUIRED_REASONS) tollReason?:TollRequiredReason;@IsOptional() @IsDateString() departureTime?:string;@IsOptional() @IsObject() vehicle?:Record<string,unknown>;}
export class TransitLiveDto extends TrafficLiveDto {@IsDateString() departureTime!:string;}
export class PlatformFeedDto {@IsString() @MaxLength(120) sourcePlatform!:string;@IsString() @MaxLength(180) sourceOpportunityId!:string;@IsString() @MaxLength(240) rawReference!:string;@IsObject() normalizedFields!:Record<string,unknown>;@IsDateString() sourceTimestamp!:string;@IsOptional() @IsDateString() validUntil?:string;@IsInt() @Min(0) confidence!:number;@IsString() @MaxLength(64) dedupFingerprint!:string;}
export class MobilityInputDto {@IsString() routeSnapshotId!:string;@IsOptional() @IsString() trafficSnapshotId?:string;@IsOptional() @IsString() tollSnapshotId?:string;@IsOptional() @IsArray() @IsString({each:true}) transitSnapshotIds?:string[];}
