import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ConversationTurnDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @IsNotEmpty() @MaxLength(4_000) text!: string;
}

export class PremiumAssistantRequestDto {
  @IsIn(['agm-cockpit']) productId!: 'agm-cockpit';
  @IsString() @IsNotEmpty() @MaxLength(80) moduleId!: string;
  @IsIn(['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq', 'it', 'es', 'sv']) language!: string;
  @IsString() @IsNotEmpty() @MaxLength(2_000) confirmedText!: string;
  @IsOptional() @IsString() @MaxLength(120) tripId?: string;
  @IsOptional() @IsString() @MaxLength(120) operationalCaseId?: string;
  @IsOptional() @IsString() @MaxLength(120) situationId?: string;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ConversationTurnDto)
  history!: ConversationTurnDto[];
}
