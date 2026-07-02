import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvidenceMetadataDto } from './dto/create-evidence-metadata.dto';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateEvidenceMetadataDto, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (dto.transportJobId) {
        await this.ensureTransportExists(dto.transportJobId, ctx, tx);
      }

      const evidence = await tx.evidenceMetadata.create({
        data: {
          companyId: ctx.companyId,
          transportJobId: dto.transportJobId,
          evidenceType: dto.evidenceType,
          storageProvider: dto.storageProvider,
          storageKey: dto.storageKey,
          originalFileName: dto.originalFileName,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
          checksumSha256: dto.checksumSha256,
          description: dto.description,
          uploadedByUserId: ctx.userId,
        },
      });

      const auditEvent = await this.audit.create(
        {
          actionCode: 'create-evidence-metadata',
          entityType: 'EvidenceMetadata',
          entityId: evidence.id,
          transportJobId: evidence.transportJobId ?? undefined,
          reason: 'Evidence metadata registered through business action API.',
          afterSnapshot: evidence,
        },
        ctx,
        tx,
      );

      return {
        evidenceId: evidence.id,
        transportJobId: evidence.transportJobId,
        evidenceType: evidence.evidenceType,
        storageProvider: evidence.storageProvider,
        storageKey: evidence.storageKey,
        auditEventId: auditEvent.id,
      };
    });
  }

  list(ctx: RequestContext) {
    return this.prisma.evidenceMetadata.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, ctx: RequestContext) {
    const evidence = await this.prisma.evidenceMetadata.findFirst({
      where: { id, companyId: ctx.companyId },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence metadata not found.');
    }

    return evidence;
  }

  private async ensureTransportExists(transportJobId: string, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const transport = await tx.transportJob.findFirst({
      where: {
        id: transportJobId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });

    if (!transport) {
      throw new NotFoundException('Transport not found.');
    }
  }
}
