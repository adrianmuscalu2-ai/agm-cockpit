import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ReviewCarMoverOfferDto {
  @IsIn(['REVIEWED', 'ACCEPTED', 'DISMISSED']) status!: 'REVIEWED' | 'ACCEPTED' | 'DISMISSED';
  @IsOptional() @IsUUID() linkedJobId?: string;
}
