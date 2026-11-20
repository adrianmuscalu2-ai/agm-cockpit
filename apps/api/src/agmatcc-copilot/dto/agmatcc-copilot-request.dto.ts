import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AgmatccConversationTurnDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @IsNotEmpty() @MaxLength(2_000) content!: string;
}

export class AgmatccCopilotRequestDto {
  @IsString() @IsNotEmpty() @MaxLength(2_000) question!: string;
  @IsIn(['ro']) language!: 'ro';
  @IsOptional() @IsString() @MaxLength(80) testMandateId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true })
  @Type(() => AgmatccConversationTurnDto) history?: AgmatccConversationTurnDto[];
}
