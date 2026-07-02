import { Type } from 'class-transformer';
import { IsDateString, IsNumberString, IsOptional, IsString, Length, ValidateNested } from 'class-validator';

class AddressSnapshotDto {
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;
}

export class CreateTransportDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  pickupAddressSnapshot?: AddressSnapshotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  deliveryAddressSnapshot?: AddressSnapshotDto;

  @IsOptional()
  @IsDateString()
  plannedPickupFrom?: string;

  @IsOptional()
  @IsDateString()
  plannedPickupTo?: string;

  @IsOptional()
  @IsDateString()
  plannedDeliveryAt?: string;

  @IsOptional()
  @IsNumberString()
  paymentAmount?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;
}
