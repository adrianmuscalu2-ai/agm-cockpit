import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

class CarMoverHistoryTurnDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @IsNotEmpty() @MaxLength(4_000) text!: string;
  @IsOptional() @IsISO8601() occurredAt?: string;
}

export class CarMoverLibraryRequestDto {
  @IsString() @IsNotEmpty() @MaxLength(2_000) query!: string;
  @IsIn(['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq', 'it', 'es', 'sv']) language!: string;
  @IsIn(['ANDROID', 'BROWSER']) surface!: 'ANDROID' | 'BROWSER';
  @IsOptional() @IsUUID() jobId?: string;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CarMoverHistoryTurnDto)
  history!: CarMoverHistoryTurnDto[];
  @IsOptional() @IsObject() profileContext?: Record<string, unknown>;
}
