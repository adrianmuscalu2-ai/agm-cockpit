import { IsIn, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SHARED_ARCHIVE_CATEGORIES } from './shared-archive.policy';

export class CreateSharedArchiveRecordDto {
  @IsOptional() @IsUUID() recordId?: string;
  @IsIn(SHARED_ARCHIVE_CATEGORIES) category!: (typeof SHARED_ARCHIVE_CATEGORIES)[number];
  @IsString() @IsNotEmpty() @MaxLength(120) namespace!: string;
  @IsString() @IsNotEmpty() @MaxLength(180) title!: string;
  @IsObject() payload!: Record<string, unknown>;
  @IsString() @IsNotEmpty() @MaxLength(8_000) searchText!: string;
  @IsIn(['SYNC_ALLOWED', 'SYNC_REQUIRED']) syncPolicy!: 'SYNC_ALLOWED' | 'SYNC_REQUIRED';
  @IsIn(['USER_APPROVED_PERSISTENT']) persistence!: 'USER_APPROVED_PERSISTENT';
  @IsIn(['ANDROID', 'BROWSER']) sourceSurface!: 'ANDROID' | 'BROWSER';
  @IsISO8601() userApprovedAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(240) approvalEvidence!: string;
  @IsOptional() @IsISO8601() observedAt?: string;
}

export class QuerySharedArchiveDto {
  @IsString() @IsNotEmpty() @MaxLength(2_000) query!: string;
  @IsOptional() @IsIn(SHARED_ARCHIVE_CATEGORIES) category?: (typeof SHARED_ARCHIVE_CATEGORIES)[number];
  @IsIn(['ANDROID', 'BROWSER']) requestSurface!: 'ANDROID' | 'BROWSER';
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}

export class RevokeSharedArchiveRecordDto {
  @IsString() @IsNotEmpty() @MaxLength(240) reason!: string;
}
