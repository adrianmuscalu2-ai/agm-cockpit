import { IsDateString, IsIn, IsNumberString, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class RecordCarMoverInvoiceDto {
  @IsIn(['ISSUED', 'RECEIVED']) direction!: 'ISSUED' | 'RECEIVED';
  @IsString() @Length(1, 120) invoiceNumber!: string;
  @IsString() @Length(1, 240) counterparty!: string;
  @IsDateString() issueDate!: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsNumberString() amount!: string;
  @IsString() @Length(3, 3) currencyCode!: string;
  @IsOptional() @IsString() @MaxLength(500) evidenceReference?: string;
  @IsOptional() @IsString() @MaxLength(240) externalAccountingReference?: string;
}
