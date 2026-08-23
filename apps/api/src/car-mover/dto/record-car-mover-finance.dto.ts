import { IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export const carMoverFinancialEntryTypes = ['REVENUE', 'COST', 'PAYMENT', 'REVERSAL'] as const;

export class RecordCarMoverFinanceDto {
  @IsIn(carMoverFinancialEntryTypes) entryType!: typeof carMoverFinancialEntryTypes[number];
  @IsString() @Length(1, 64) category!: string;
  @IsNumberString() amount!: string;
  @IsString() @Length(3, 3) currencyCode!: string;
  @IsDateString() occurredAt!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(240) sourceReference?: string;
  @IsOptional() @IsUUID() reversalOfId?: string;
}
