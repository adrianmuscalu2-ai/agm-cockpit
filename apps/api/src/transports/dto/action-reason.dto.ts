import { IsOptional, IsString } from 'class-validator';

export class ActionReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
