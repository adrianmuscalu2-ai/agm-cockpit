import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateIncidentDto {
  @IsUUID()
  transportJobId!: string;

  @IsString()
  incidentType!: string;

  @IsIn(['low', 'medium', 'high', 'critical'])
  severity!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
