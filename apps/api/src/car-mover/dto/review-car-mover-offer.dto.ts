import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { vehicleClasses, type VehicleClass } from '../car-mover.contract';

export class ReviewCarMoverOfferDto {
  @IsIn(['REVIEWED', 'ACCEPTED', 'DISMISSED']) status!: 'REVIEWED' | 'ACCEPTED' | 'DISMISSED';
  @IsOptional() @IsUUID() linkedJobId?: string;
  @IsOptional() @IsIn(vehicleClasses) confirmedVehicleClass?: VehicleClass;
}
