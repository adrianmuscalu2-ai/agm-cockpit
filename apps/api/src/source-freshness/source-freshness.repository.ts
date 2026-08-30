import { Injectable } from '@nestjs/common';
import { Prisma, type SourceFreshnessAlertLedger, type SourceFreshnessReviewQueue, type SourceFreshnessRuntimeState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AlertLedgerEntry, SourceFreshnessEvaluation, SourceFreshnessObservation } from './source-freshness.contract';

export abstract class SourceFreshnessRepository {
  abstract state(sourceId: string): Promise<SourceFreshnessRuntimeState | null>;
  abstract states(): Promise<SourceFreshnessRuntimeState[]>;
  abstract ledger(sourceId: string): Promise<AlertLedgerEntry[]>;
  abstract persistEvaluation(evaluation: SourceFreshnessEvaluation, observation: SourceFreshnessObservation): Promise<void>;
  abstract persistSentAlert(entry: AlertLedgerEntry): Promise<void>;
  abstract enqueueReview(evaluation: SourceFreshnessEvaluation, checkedAt: string): Promise<void>;
  abstract reviews(): Promise<SourceFreshnessReviewQueue[]>;
}

@Injectable()
export class PrismaSourceFreshnessRepository implements SourceFreshnessRepository {
  constructor(private readonly prisma: PrismaService) {}

  state(sourceId: string) { return this.prisma.sourceFreshnessRuntimeState.findUnique({ where: { sourceId } }); }
  states() { return this.prisma.sourceFreshnessRuntimeState.findMany({ orderBy: { sourceId: 'asc' } }); }
  async ledger(sourceId: string) {
    const rows = await this.prisma.sourceFreshnessAlertLedger.findMany({ where: { sourceId }, orderBy: { sentAt: 'asc' } });
    return rows.map(toLedger);
  }

  async persistEvaluation(evaluation: SourceFreshnessEvaluation, observation: SourceFreshnessObservation) {
    const data = {
      status: evaluation.status,
      reviewRequired: evaluation.reviewRequired,
      lastEvaluatedAt: new Date(observation.checkedAt),
      lastObservation: observation as unknown as Prisma.InputJsonValue,
      candidateReview: evaluation.candidateReview
        ? evaluation.candidateReview as unknown as Prisma.InputJsonValue
        : Prisma.DbNull,
    };
    await this.prisma.sourceFreshnessRuntimeState.upsert({
      where: { sourceId: evaluation.source.sourceId },
      create: { sourceId: evaluation.source.sourceId, ...data },
      update: data,
    });
  }

  async persistSentAlert(entry: AlertLedgerEntry) {
    await this.prisma.sourceFreshnessAlertLedger.create({
      data: {
        dedupKey: entry.dedupKey,
        sourceId: entry.sourceId,
        alertType: entry.alertType,
        status: entry.status,
        sentAt: new Date(entry.sentAt),
        acknowledgedAt: entry.acknowledgedAt ? new Date(entry.acknowledgedAt) : null,
      },
    });
  }

  async enqueueReview(evaluation: SourceFreshnessEvaluation, checkedAt: string) {
    if (!evaluation.reviewRequired) return;
    const candidateIdentity = evaluation.candidateReview?.candidate.version
      ?? evaluation.candidateReview?.candidate.effectiveFrom
      ?? evaluation.candidateReview?.candidate.sha256
      ?? evaluation.candidateReview?.candidate.officialUrl
      ?? evaluation.source.effectiveUntil
      ?? evaluation.source.version
      ?? evaluation.status;
    const reviewKey = `${evaluation.source.sourceId}|${evaluation.status}|${candidateIdentity}`;
    const reason = evaluation.alerts[0]?.condition ?? `Source requires review: ${evaluation.status}`;
    await this.prisma.sourceFreshnessReviewQueue.upsert({
      where: { reviewKey },
      create: {
        reviewKey,
        sourceId: evaluation.source.sourceId,
        status: evaluation.status,
        reason,
        candidate: evaluation.candidateReview?.candidate as unknown as Prisma.InputJsonValue ?? Prisma.DbNull,
        firstDetectedAt: new Date(checkedAt),
        lastDetectedAt: new Date(checkedAt),
      },
      update: {
        status: evaluation.status,
        reason,
        candidate: evaluation.candidateReview?.candidate as unknown as Prisma.InputJsonValue ?? Prisma.DbNull,
        lastDetectedAt: new Date(checkedAt),
      },
    });
  }

  reviews() { return this.prisma.sourceFreshnessReviewQueue.findMany({ orderBy: [{ reviewState: 'asc' }, { lastDetectedAt: 'desc' }] }); }
}

function toLedger(row: SourceFreshnessAlertLedger): AlertLedgerEntry {
  return {
    dedupKey: row.dedupKey,
    sourceId: row.sourceId,
    alertType: row.alertType as AlertLedgerEntry['alertType'],
    status: row.status as AlertLedgerEntry['status'],
    sentAt: row.sentAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString(),
  };
}
