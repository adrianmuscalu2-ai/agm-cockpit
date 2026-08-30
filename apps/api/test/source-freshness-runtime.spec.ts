import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { CanonicalAuthorityLoader } from '../src/canonical-authority/canonical-authority.loader';
import { CanonicalAuthorityRuntimeOverlay } from '../src/canonical-authority/canonical-authority.overlay';
import type { CommunicationProviderPort } from '../src/communications/communication-provider.port';
import type { AlertLedgerEntry, SourceFreshnessEvaluation, SourceFreshnessObservation, SourceFreshnessRecord } from '../src/source-freshness/source-freshness.contract';
import { SourceFreshnessDetectionHook } from '../src/source-freshness/source-freshness.detector';
import { SourceFreshnessRepository } from '../src/source-freshness/source-freshness.repository';
import { SourceFreshnessScanService } from '../src/source-freshness/source-freshness.scan.service';

class MemoryRepository extends SourceFreshnessRepository {
  readonly stateRows = new Map<string, any>();
  readonly alertRows: AlertLedgerEntry[] = [];
  readonly reviewRows = new Map<string, any>();
  async state(sourceId: string) { return this.stateRows.get(sourceId) ?? null; }
  async states() { return [...this.stateRows.values()]; }
  async ledger(sourceId: string) { return this.alertRows.filter((row) => row.sourceId === sourceId); }
  async persistEvaluation(evaluation: SourceFreshnessEvaluation, observation: SourceFreshnessObservation) {
    this.stateRows.set(evaluation.source.sourceId, {
      sourceId: evaluation.source.sourceId,
      status: evaluation.status,
      reviewRequired: evaluation.reviewRequired,
      lastEvaluatedAt: new Date(observation.checkedAt),
      lastObservation: observation,
    });
  }
  async persistSentAlert(entry: AlertLedgerEntry) { this.alertRows.push(entry); }
  async enqueueReview(evaluation: SourceFreshnessEvaluation, checkedAt: string) {
    if (!evaluation.reviewRequired) return;
    const key = `${evaluation.source.sourceId}|${evaluation.status}`;
    this.reviewRows.set(key, { reviewKey: key, sourceId: evaluation.source.sourceId, status: evaluation.status, lastDetectedAt: new Date(checkedAt) });
  }
  async reviews() { return [...this.reviewRows.values()]; }
}

class MetadataDetector extends SourceFreshnessDetectionHook {
  async inspect(_source: SourceFreshnessRecord, checkedAt: string) { return { checkedAt, checkOutcome: 'NOT_RUN' as const }; }
}

describe('source freshness runtime scan', () => {
  it('persists review state, updates the runtime overlay, and leaves canonical files byte-identical', async () => {
    const root = resolve(process.cwd(), '..', '..');
    const paths = [
      'AGM_LIBRARY/REGISTRY/canonical-sources.json',
      'AGM_LIBRARY/VIEWS/routing-toll.view.json',
      'AGM_LIBRARY/VIEWS/legislation-safety.view.json',
    ];
    const hashes = () => paths.map((path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'));
    const before = hashes();
    const config = new ConfigService({ AGM_CANONICAL_LIBRARY_ROOT: root });
    const library = new CanonicalAuthorityLoader(config);
    const overlay = new CanonicalAuthorityRuntimeOverlay();
    const repository = new MemoryRepository();
    const email: CommunicationProviderPort = {
      channel: 'email', provider: 'unconfigured-test', configured: () => false,
      send: async () => { throw new Error('must not send'); },
    };
    const scanner = new SourceFreshnessScanService(
      library,
      overlay,
      repository,
      new MetadataDetector(),
      email as never,
      config,
    );
    const first = await scanner.scan('2026-08-31T08:00:00.000Z');
    const second = await scanner.scan('2026-08-31T08:00:00.000Z');
    expect(first.scanned).toBe(31);
    expect(first.results.find((row) => row.sourceId === 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026')).toMatchObject({
      status: 'EXPIRED_REVIEW_REQUIRED', reviewRequired: true,
    });
    expect(first.results.find((row) => row.sourceId === 'CS-NL-GOV-TRUCK-TOLL-RATES-2026')).toMatchObject({
      status: 'EXPIRED_REVIEW_REQUIRED', reviewRequired: true,
    });
    expect(first.results.find((row) => row.sourceId === 'CS-CH-ARV1-20250501')).toMatchObject({
      status: 'NEW_VERSION_DETECTED', reviewRequired: true,
    });
    expect(overlay.get('CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026')?.status).toBe('EXPIRED_REVIEW_REQUIRED');
    expect(repository.stateRows.size).toBe(31);
    expect(second.mutationGuardrails).toEqual({ registry: 'NONE', views: 'NONE', authorityPromotion: 'NONE', sourceValues: 'NONE' });
    expect(hashes()).toEqual(before);
  });
});
