import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateEvidenceMetadataDto {
  @IsOptional()
  @IsUUID()
  transportJobId?: string;

  @IsString()
  evidenceType!: string;

  @IsString()
  storageProvider!: string;

  @IsString()
  storageKey!: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  checksumSha256?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
