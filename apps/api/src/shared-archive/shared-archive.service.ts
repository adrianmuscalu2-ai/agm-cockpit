import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AgmSharedArchiveRecord } from '@prisma/client';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSharedArchiveRecordDto, QuerySharedArchiveDto } from './shared-archive.dto';
import { assertSharedArchiveWritePolicy, SHARED_ARCHIVE_CONTRACT_VERSION, type SharedArchiveCategory } from './shared-archive.policy';

type ArchivePrisma = Pick<PrismaService, 'agmSharedArchiveRecord'>;

@Injectable()
export class SharedArchiveService {
  constructor(private readonly prisma: ArchivePrisma) {}

  async create(ctx: RequestContext, dto: CreateSharedArchiveRecordDto) {
    this.authorizeIdentity(ctx);
    try {
      assertSharedArchiveWritePolicy(dto);
      assertSafePayload(dto.payload);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'ARCHIVE_POLICY_REJECTED');
    }
    const observedAt = dto.observedAt ? new Date(dto.observedAt) : new Date();
    return this.prisma.agmSharedArchiveRecord.create({ data: {
      ...(dto.recordId ? { id: dto.recordId } : {}),
      companyId: ctx.companyId,
      ownerUserId: ctx.userId,
      category: dto.category,
      namespace: normalizeNamespace(dto.namespace),
      title: dto.title.trim(),
      payload: dto.payload as Prisma.InputJsonValue,
      searchText: normalizeSearchText(`${dto.title}\n${dto.searchText}`),
      syncPolicy: dto.syncPolicy,
      persistence: dto.persistence,
      sourceSurface: dto.sourceSurface,
      userApprovedAt: new Date(dto.userApprovedAt),
      approvalEvidence: dto.approvalEvidence.trim(),
      observedAt,
      contractVersion: SHARED_ARCHIVE_CONTRACT_VERSION,
    } });
  }

  async query(ctx: RequestContext, dto: QuerySharedArchiveDto) {
    this.authorizeIdentity(ctx);
    const terms = significantTerms(dto.query);
    const records = await this.prisma.agmSharedArchiveRecord.findMany({
      where: {
        companyId: ctx.companyId,
        ownerUserId: ctx.userId,
        revokedAt: null,
        deletedAt: null,
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.from || dto.to ? { observedAt: { ...(dto.from ? { gte: new Date(dto.from) } : {}), ...(dto.to ? { lte: new Date(dto.to) } : {}) } } : {}),
        ...(terms.length ? { OR: terms.slice(0, 6).map((term) => ({ searchText: { contains: term, mode: 'insensitive' as const } })) } : {}),
      },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      take: 40,
    });
    return records
      .map((record) => ({ record, score: archiveScore(record.searchText, terms) }))
      .sort((left, right) => right.score - left.score || right.record.observedAt.getTime() - left.record.observedAt.getTime())
      .slice(0, 12)
      .map(({ record }) => minimalRecord(record));
  }

  async revoke(ctx: RequestContext, id: string, reason: string) {
    this.authorizeIdentity(ctx);
    const record = await this.ownedActive(ctx, id);
    return this.prisma.agmSharedArchiveRecord.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), revocationReason: reason.trim().slice(0, 240) },
    }).then(minimalRecord);
  }

  async delete(ctx: RequestContext, id: string) {
    this.authorizeIdentity(ctx);
    const record = await this.ownedActive(ctx, id);
    return this.prisma.agmSharedArchiveRecord.update({
      where: { id: record.id },
      data: { deletedAt: new Date(), payload: Prisma.JsonNull, searchText: '', title: '[deleted]' },
    }).then(minimalRecord);
  }

  private authorizeIdentity(ctx: RequestContext) {
    if (!ctx.companyId?.trim() || !ctx.userId?.trim()) throw new ForbiddenException('ARCHIVE_IDENTITY_NOT_PROVEN');
  }

  private async ownedActive(ctx: RequestContext, id: string) {
    const record = await this.prisma.agmSharedArchiveRecord.findFirst({ where: {
      id, companyId: ctx.companyId, ownerUserId: ctx.userId, revokedAt: null, deletedAt: null,
    } });
    if (!record) throw new NotFoundException('ARCHIVE_RECORD_NOT_FOUND');
    return record;
  }
}

function minimalRecord(record: AgmSharedArchiveRecord) {
  return {
    id: record.id,
    category: record.category as SharedArchiveCategory,
    namespace: record.namespace,
    title: record.title,
    payload: record.payload,
    syncPolicy: record.syncPolicy,
    persistence: record.persistence,
    sourceSurface: record.sourceSurface,
    observedAt: record.observedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString() ?? null,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    provenance: {
      ownerUserId: record.ownerUserId,
      namespace: record.namespace,
      contractVersion: record.contractVersion,
      approvalEvidence: record.approvalEvidence,
    },
  };
}

function normalizeNamespace(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 120);
}

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 12_000);
}

function significantTerms(value: string) {
  const stop = new Set(['ce', 'am', 'ai', 'despre', 'din', 'de', 'la', 'pe', 'un', 'o', 'si', 'ieri', 'ultima', 'ultimul', 'foloseste', 'gaseste', 'document', 'scanat', 'traducerea', 'the', 'about', 'from', 'yesterday', 'last', 'find', 'use']);
  return [...new Set((normalizeSearchText(value).match(/[a-z0-9]+/g) ?? []).filter((term) => term.length >= 2 && !stop.has(term)))];
}

function archiveScore(searchText: string, terms: readonly string[]) {
  if (!terms.length) return 1;
  return terms.reduce((score, term) => score + (searchText.includes(term) ? 3 : 0), 0);
}

function assertSafePayload(payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  if (serialized.length > 32_000) throw new Error('ARCHIVE_PAYLOAD_TOO_LARGE');
  if (/data:image\/|authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|password|cookie/i.test(serialized)) {
    throw new Error('ARCHIVE_PROHIBITED_SENSITIVE_PAYLOAD');
  }
}
