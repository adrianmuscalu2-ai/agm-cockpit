import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AgmatccCopilotRequestDto {
  @IsString() @IsNotEmpty() @MaxLength(2_000) question!: string;
  @IsIn(['ro']) language!: 'ro';
  @IsOptional() @IsString() @MaxLength(80) testMandateId?: string;
}
