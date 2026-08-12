import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { vehicleClasses, type VehicleClass } from '../car-mover.contract';

class LocationDto {
  @IsString() @IsNotEmpty() @MaxLength(240) label!: string;
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;
}

class VehicleSubjectDto {
  @IsIn(vehicleClasses) vehicleClass!: VehicleClass;
  @IsString() @IsNotEmpty() @MaxLength(80) vehicleType!: string;
  @IsOptional() @IsString() @MaxLength(120) make?: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsString() @MaxLength(32) vin?: string;
  @IsOptional() @IsString() @MaxLength(32) registration?: string;
  @IsOptional() @IsObject() details?: Record<string,unknown>;
}

export class CreateCarMoverJobDto {
  @ValidateNested() @Type(() => VehicleSubjectDto) vehicle!: VehicleSubjectDto;
  @ValidateNested() @Type(() => LocationDto) pickup!: LocationDto;
  @ValidateNested() @Type(() => LocationDto) destination!: LocationDto;
  @IsOptional() @IsString() @MaxLength(160) sourceReference?: string;
}
