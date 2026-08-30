import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanonicalAuthorityLoader } from '../canonical-authority/canonical-authority.loader';
import { CanonicalAuthorityRuntimeOverlay } from '../canonical-authority/canonical-authority.overlay';
import type { CanonicalSource } from '../canonical-authority/canonical-authority.contract';
import { GmailCommunicationProvider } from '../communications/providers/gmail.provider';
import { sourceFreshnessStatuses, type SourceFreshnessRecord } from './source-freshness.contract';
import { SourceFreshnessDetectionHook } from './source-freshness.detector';
import { dispatchSourceAlertEmails, PRODUCT_OWNER_ALERT_EMAIL_ENV } from './source-freshness.email';
import { evaluateSourceFreshness } from './source-freshness.engine';
import { SourceFreshnessRepository } from './source-freshness.repository';

@Injectable()
export class SourceFreshnessScanService {
  constructor(
    private readonly library: CanonicalAuthorityLoader,
    private readonly overlay: CanonicalAuthorityRuntimeOverlay,
    private readonly repository: SourceFreshnessRepository,
    private readonly detector: SourceFreshnessDetectionHook,
    private readonly email: GmailCommunicationProvider,
    private readonly config: ConfigService,
  ) {}

  async scan(checkedAt = new Date().toISOString()) {
    const sources = this.library.sources().filter(isFreshnessManagedSource).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    const results: Array<{ sourceId: string; status: string; reviewRequired: boolean; alerts: string[]; emailGate: string[] }> = [];
    for (const canonical of sources) {
      const base = this.toRecord(canonical);
      const stored = await this.repository.state(base.sourceId);
      const source = stored ? { ...base, currentStatus: stored.status as SourceFreshnessRecord['currentStatus'], reviewRequired: stored.reviewRequired } : base;
      const observation = await this.detector.inspect(source, checkedAt);
      const ledger = await this.repository.ledger(source.sourceId);
      const evaluation = evaluateSourceFreshness(source, observation, ledger, reminderPolicy(this.config));
      await this.repository.persistEvaluation(evaluation, observation);
      await this.repository.enqueueReview(evaluation, checkedAt);
      this.overlay.set(source.sourceId, { status: evaluation.status, reviewRequired: evaluation.reviewRequired, evaluatedAt: checkedAt });
      const emailGates: string[] = [];
      for (const alert of evaluation.alerts) {
        const delivery = await dispatchSourceAlertEmails({
          source: evaluation.source,
          event: alert,
          recipientConfiguration: this.config.get<string>(PRODUCT_OWNER_ALERT_EMAIL_ENV),
          timestamp: checkedAt,
          reviewPackagePath: `SOURCE_FRESHNESS_REVIEW/${encodeURIComponent(source.sourceId)}/${encodeURIComponent(alert.dedupKey)}.json`,
          transport: this.email,
        });
        emailGates.push(delivery.status);
        if (delivery.status === 'SENT' && delivery.ledgerEntry) await this.repository.persistSentAlert(delivery.ledgerEntry);
      }
      results.push({ sourceId: source.sourceId, status: evaluation.status, reviewRequired: evaluation.reviewRequired, alerts: evaluation.alerts.map((item) => item.alertType), emailGate: emailGates });
    }
    return {
      contractVersion: 'agm-source-freshness.runtime.v1',
      checkedAt,
      scanned: results.length,
      mutationGuardrails: { registry: 'NONE', views: 'NONE', authorityPromotion: 'NONE', sourceValues: 'NONE' },
      results,
    };
  }

  states() { return this.repository.states(); }
  reviews() { return this.repository.reviews(); }

  private toRecord(source: CanonicalSource): SourceFreshnessRecord {
    const domains = [
      this.library.contains('ROUTING_TOLL', source.sourceId) ? 'ROUTING_TOLL' : null,
      this.library.contains('LEGISLATION_SAFETY', source.sourceId) ? 'LEGISLATION_SAFETY' : null,
    ].filter(Boolean).join('+');
    const freshness = source.freshness!;
    const currentStatus = sourceFreshnessStatuses.includes(freshness.currentStatus as never)
      ? freshness.currentStatus as SourceFreshnessRecord['currentStatus']
      : 'CURRENT';
    return {
      sourceId: source.sourceId,
      country: source.authority.jurisdictions.join(',') || 'UNKNOWN',
      domain: domains,
      authority: source.authority.issuingBody ?? 'UNKNOWN_AUTHORITY',
      authorityClassification: source.authority.authorityType as SourceFreshnessRecord['authorityClassification'],
      title: source.version ?? source.sourceId,
      officialUrl: source.canonicalUri!,
      effectiveFrom: freshness.effectiveFrom ?? source.effectiveDate,
      effectiveUntil: freshness.effectiveUntil ?? null,
      version: source.version,
      capturedAt: freshness.capturedAt ?? `${source.sourceDate ?? '1970-01-01'}T00:00:00.000Z`,
      lastFreshnessCheck: freshness.lastFreshnessCheck ?? null,
      nextFreshnessCheck: normalizedScheduledCheck(freshness.nextFreshnessCheck),
      sha256: source.sha256,
      currentStatus,
      supersedes: [...source.supersedes],
      supersededBy: [...source.supersededBy],
      reviewRequired: freshness.reviewRequired ?? currentStatus !== 'CURRENT',
    };
  }
}

function isFreshnessManagedSource(source: CanonicalSource) {
  return Boolean(
    source.freshness
    && source.canonicalUri
    && ['AUTHORITATIVE', 'AUTHORITATIVE_WITH_SCOPE', 'CONTEXTUAL'].includes(source.authority.authorityType),
  );
}
function reminderPolicy(config: ConfigService) {
  const value = Number(config.get<string>('AGM_SOURCE_FRESHNESS_REMINDER_DAYS'));
  return Number.isInteger(value) && value > 0 ? { resendAfterDays: value } : {};
}

function normalizedScheduledCheck(value?: string | null) {
  if (!value) return null;
  if (Number.isFinite(new Date(value).getTime())) return value;
  // Canonical BEFORE_USE-style requirements are not dates and must not be
  // converted into invented expiry metadata. 1970 is an internal due marker
  // that makes the first runtime scan fail closed until a real check confirms
  // currentness; the original canonical metadata remains untouched.
  return '1970-01-01';
}
