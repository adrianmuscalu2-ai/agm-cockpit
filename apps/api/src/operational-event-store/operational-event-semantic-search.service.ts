import { Injectable } from '@nestjs/common';
import { cosine, embedText, matchedConcepts, queryConceptSet, SEMANTIC_INDEX_VERSION, SEMANTIC_MIN_SCORE } from '@agm/shared';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

export const SEMANTIC_SCAN_LIMIT = 2000;

export interface SemanticCandidate {
  eventId: string;
  streamId: string;
  eventType: string;
  aggregateVersion: number;
  recordedAt: Date;
  payload: unknown;
}

export function flattenPayloadText(value: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > 4 || out.length > 200) return out;
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'number' || typeof value === 'boolean') out.push(String(value));
  else if (Array.isArray(value)) value.forEach((item) => flattenPayloadText(item, depth + 1, out));
  else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach((item) => flattenPayloadText(item, depth + 1, out));
  return out;
}

export function rankSemanticCandidates(candidates: readonly SemanticCandidate[], query: string, limit: number) {
  const queryVector = embedText(query);
  const queryConcepts = queryConceptSet(query);
  return candidates
    .map((candidate) => {
      const text = `${candidate.eventType.replace(/[._]/g, ' ')} ${flattenPayloadText(candidate.payload).join(' ')}`.slice(0, 4000);
      return {
        eventId: candidate.eventId,
        streamId: candidate.streamId,
        eventType: candidate.eventType,
        aggregateVersion: candidate.aggregateVersion,
        recordedAt: candidate.recordedAt.toISOString(),
        score: Number(cosine(queryVector, embedText(text)).toFixed(4)),
        matchedConcepts: matchedConcepts(text, queryConcepts),
        source: `operational-event:${candidate.streamId}@${candidate.aggregateVersion}`,
      };
    })
    .filter((hit) => hit.score >= SEMANTIC_MIN_SCORE)
    .sort((a, b) => b.score - a.score || b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, limit);
}

@Injectable()
export class OperationalEventSemanticSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, limit: number, ctx: RequestContext) {
    const where = { companyId: ctx.companyId };
    const [total, rows] = await Promise.all([
      this.prisma.operationalEvent.count({ where }),
      this.prisma.operationalEvent.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        take: SEMANTIC_SCAN_LIMIT,
        select: { eventId: true, eventType: true, aggregateVersion: true, recordedAt: true, payload: true, stream: { select: { streamId: true } } },
      }),
    ]);
    const hits = rankSemanticCandidates(
      rows.map((row) => ({ eventId: row.eventId, streamId: row.stream.streamId, eventType: row.eventType, aggregateVersion: row.aggregateVersion, recordedAt: row.recordedAt, payload: row.payload })),
      query,
      limit,
    );
    return {
      index: SEMANTIC_INDEX_VERSION,
      scope: 'company-operational-events',
      coverage: { total, scanned: rows.length, complete: rows.length >= total },
      hits,
    };
  }
}
