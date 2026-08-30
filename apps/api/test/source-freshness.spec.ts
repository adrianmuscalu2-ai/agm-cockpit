import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommunicationProviderPort } from '../src/communications/communication-provider.port';
import type { OutboundCommunication } from '../src/communications/communication.contract';
import type { AlertLedgerEntry, SourceFreshnessRecord } from '../src/source-freshness/source-freshness.contract';
import { dispatchSourceAlertEmail, dispatchSourceAlertEmails, parseProductOwnerAlertRecipients, PRODUCT_OWNER_ALERT_EMAIL_ENV } from '../src/source-freshness/source-freshness.email';
import { evaluateSourceFreshness } from '../src/source-freshness/source-freshness.engine';

const nlSource: SourceFreshnessRecord = {
  candidateId: 'RT001-RES-NL-TRUCK-RATES-2026',
  sourceId: 'CS-NL-GOV-TRUCK-TOLL-RATES-2026',
  country: 'NL',
  domain: 'ROUTING_TOLL',
  authority: 'Government of the Netherlands',
  authorityClassification: 'AUTHORITATIVE_WITH_SCOPE',
  title: 'Truck toll tariff table — price level 2026',
  officialUrl: 'https://www.vrachtwagenheffing.nl/-/media/trucktol/website/wat-gaat-het-kosten/toegankelijke-pdfs/rdw-tabellen-bedragen-vrachtwagenheffing.pdf',
  effectiveFrom: '2026-07-01',
  effectiveUntil: '2026-08-31',
  version: 'Tariffs price level 2026; 2026-07-01 through 2026-08-31',
  capturedAt: '2026-08-30T00:00:00.000Z',
  lastFreshnessCheck: '2026-08-30T00:00:00.000Z',
  nextFreshnessCheck: '2026-08-31',
  sha256: '313e308e8486c37fcdf0a2baf2ce888a6c13a5ca3c713857125366f4e0940422',
  currentStatus: 'CURRENT',
  supersedes: [],
  supersededBy: [],
  reviewRequired: false,
};

describe('source freshness / expiry / supersession policy', () => {
  it.each([
    ['2026-08-01T10:00:00Z', 'EXPIRY_30_DAYS'],
    ['2026-08-17T10:00:00Z', 'EXPIRY_14_DAYS'],
    ['2026-08-24T10:00:00Z', 'EXPIRY_7_DAYS'],
    ['2026-08-30T10:00:00Z', 'EXPIRY_1_DAY'],
  ])('emits the required expiry threshold at %s', (checkedAt, alertType) => {
    const result = evaluateSourceFreshness(
      { ...nlSource, nextFreshnessCheck: null },
      { checkedAt, checkOutcome: 'CONFIRMED_CURRENT' },
    );
    expect(result.status).toBe('EXPIRY_WARNING');
    expect(result.reviewRequired).toBe(true);
    expect(result.alerts.map((alert) => alert.alertType)).toContain(alertType);
  });

  it('blocks current use on the expiry date and still emits the expiry-day alert', () => {
    const result = evaluateSourceFreshness(
      { ...nlSource, nextFreshnessCheck: null },
      { checkedAt: '2026-08-31T10:00:00Z', checkOutcome: 'CONFIRMED_CURRENT' },
    );
    expect(result.status).toBe('EXPIRED_REVIEW_REQUIRED');
    expect(result.usageDisposition).toBe('UNKNOWN_HUMAN_VERIFICATION');
    expect(result.resolvedValue).toBeNull();
    expect(result.alerts.map((alert) => alert.alertType)).toContain('EXPIRY_DAY');
  });

  it('expires NL after the inclusive 2026-08-31 window without deleting or zeroing it', () => {
    const result = evaluateSourceFreshness(nlSource, {
      checkedAt: '2026-09-01T00:00:00.000Z',
      checkOutcome: 'NOT_RUN',
    });
    expect(result.status).toBe('EXPIRED_REVIEW_REQUIRED');
    expect(result.source.sourceId).toBe(nlSource.sourceId);
    expect(result.source.sha256).toBe(nlSource.sha256);
    expect(result.usageDisposition).toBe('UNKNOWN_HUMAN_VERIFICATION');
    expect(result.resolvedValue).toBeNull();
    expect(result.alerts.map((alert) => alert.alertType)).toContain('EXPIRED');
  });

  it('detects a new NL version as a candidate and never promotes it', () => {
    const result = evaluateSourceFreshness(nlSource, {
      checkedAt: '2026-08-30T12:00:00.000Z',
      checkOutcome: 'CONFIRMED_CURRENT',
      detectedCandidate: {
        candidateId: 'RT001-CAND-NL-TRUCK-RATES-2026-09',
        officialUrl: 'https://www.vrachtwagenheffing.nl/official-rate-change-2026-09',
        version: '2026-09-01 tariff revision',
        effectiveFrom: '2026-09-01',
        detectedAt: '2026-08-30T12:00:00.000Z',
      },
    });
    expect(result.status).toBe('NEW_VERSION_DETECTED');
    expect(result.candidateReview).toMatchObject({
      comparisonStatus: 'PENDING_PRODUCT_OWNER_REVIEW',
      automaticPromotion: false,
    });
    expect(result.source.authorityClassification).toBe(nlSource.authorityClassification);
    expect(result.source.supersededBy).toEqual([]);
    expect(result.guardrails).toEqual({
      registryMutation: 'NONE',
      routingTollViewMutation: 'NONE',
      authorityPromotion: 'NONE',
      tariffMutation: 'NONE',
      productionDataMutation: 'NONE',
    });
  });

  it('keeps an unresolved review state sticky across scheduler runs', () => {
    const detected = evaluateSourceFreshness(nlSource, {
      checkedAt: '2026-08-30T12:00:00.000Z',
      checkOutcome: 'CONFIRMED_CURRENT',
      detectedCandidate: {
        officialUrl: 'https://www.vrachtwagenheffing.nl/official-rate-change-2026-09',
        version: '2026-09-01 tariff revision',
        effectiveFrom: '2026-09-01',
        detectedAt: '2026-08-30T12:00:00.000Z',
      },
    });
    const laterRun = evaluateSourceFreshness(detected.source, {
      checkedAt: '2026-08-30T13:00:00.000Z',
      checkOutcome: 'CONFIRMED_CURRENT',
    });
    expect(laterRun.status).toBe('NEW_VERSION_DETECTED');
    expect(laterRun.reviewRequired).toBe(true);
    expect(laterRun.guardrails.authorityPromotion).toBe('NONE');
  });

  it('marks a claimed supersession pending review without mutating authority links', () => {
    const result = evaluateSourceFreshness(nlSource, {
      checkedAt: '2026-08-30T14:00:00.000Z',
      checkOutcome: 'CONFIRMED_CURRENT',
      detectedCandidate: {
        officialUrl: 'https://official.example.test/replacement',
        version: 'replacement-v2',
        detectedAt: '2026-08-30T14:00:00.000Z',
        supersessionClaimed: true,
      },
    });
    expect(result.status).toBe('SUPERSEDED_PENDING_REVIEW');
    expect(result.alerts.map((alert) => alert.alertType)).toContain('SUPERSEDED_PENDING_REVIEW');
    expect(result.source.supersededBy).toEqual([]);
    expect(result.candidateReview?.automaticPromotion).toBe(false);
  });

  it('does not invent expiry for a source without an explicit end date', () => {
    const source = { ...nlSource, effectiveUntil: null, nextFreshnessCheck: '2026-09-30' };
    const result = evaluateSourceFreshness(source, {
      checkedAt: '2026-09-30T09:00:00.000Z',
      checkOutcome: 'FAILED',
      checkFailureReason: 'Official source currentness could not be confirmed.',
    });
    expect(result.source.effectiveUntil).toBeNull();
    expect(result.status).toBe('FRESHNESS_UNKNOWN');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].alertType).toBe('FRESHNESS_UNKNOWN');
    expect(result.resolvedValue).toBeNull();
  });

  it('treats the DK Q3 review as a freshness trigger, not an automatic extension', () => {
    const dkSource: SourceFreshnessRecord = {
      ...nlSource,
      candidateId: 'RT001-RES-DK-KMTOLL-TARIFF-V12',
      sourceId: 'CS-DK-KMTOLL-TARIFF-TABLE-V1-2',
      country: 'DK',
      authority: 'Sund & Baelt / KmToll',
      title: 'Annex B / Tariff Table v1.2',
      officialUrl: 'https://vejafgifter.dk/media/rtopb53s/annex-b-tariff-table-_v12.pdf',
      effectiveFrom: null,
      effectiveUntil: null,
      version: '1.2',
      nextFreshnessCheck: '2026-09-30',
      sha256: 'a61667515f888b6fd8df6ea8494060967865a5e9b7aedda6707a74b520192608',
    };
    const result = evaluateSourceFreshness(dkSource, {
      checkedAt: '2026-09-30T08:00:00.000Z',
      checkOutcome: 'NOT_RUN',
    });
    expect(result.status).toBe('FRESHNESS_UNKNOWN');
    expect(result.source.version).toBe('1.2');
    expect(result.source.effectiveUntil).toBeNull();
    expect(result.guardrails.authorityPromotion).toBe('NONE');
  });

  it('deduplicates an unchanged alert and permits a distinct threshold', () => {
    const first = evaluateSourceFreshness(
      { ...nlSource, nextFreshnessCheck: null },
      { checkedAt: '2026-08-24T10:00:00.000Z', checkOutcome: 'CONFIRMED_CURRENT' },
    );
    const sent: AlertLedgerEntry[] = first.alerts.map((alert) => ({
      dedupKey: alert.dedupKey,
      sourceId: alert.sourceId,
      alertType: alert.alertType,
      status: alert.status,
      sentAt: '2026-08-24T10:00:00.000Z',
    }));
    const duplicate = evaluateSourceFreshness(
      { ...nlSource, nextFreshnessCheck: null },
      { checkedAt: '2026-08-25T10:00:00.000Z', checkOutcome: 'CONFIRMED_CURRENT' },
      sent,
    );
    const nextThreshold = evaluateSourceFreshness(
      { ...nlSource, nextFreshnessCheck: null },
      { checkedAt: '2026-08-30T10:00:00.000Z', checkOutcome: 'CONFIRMED_CURRENT' },
      sent,
    );
    expect(duplicate.alerts).toHaveLength(0);
    expect(nextThreshold.alerts.map((alert) => alert.alertType)).toEqual(['EXPIRY_1_DAY']);
  });

  it('builds and sends the minimum Product Owner email through the existing provider port', async () => {
    const result = evaluateSourceFreshness(
      { ...nlSource, nextFreshnessCheck: null },
      { checkedAt: '2026-08-30T10:00:00.000Z', checkOutcome: 'CONFIRMED_CURRENT' },
    );
    const sent: OutboundCommunication[] = [];
    const transport: CommunicationProviderPort = {
      channel: 'email',
      provider: 'test-email',
      configured: () => true,
      send: async (message) => {
        sent.push(message);
        return { providerMessageId: 'test-1', status: 'sent' };
      },
    };
    const dispatched = await dispatchSourceAlertEmail({
      source: result.source,
      event: result.alerts[0],
      recipient: 'product-owner@example.test',
      timestamp: '2026-08-30T10:00:00.000Z',
      reviewPackagePath: 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/REVIEW_PACKAGES/NL-2026-09.json',
      transport,
    });
    expect(dispatched.status).toBe('SENT');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe(`[AGM SOURCE ALERT] EXPIRY_WARNING — ${nlSource.sourceId}`);
    for (const required of ['SourceId:', 'Country / domain:', 'Authority:', 'Source title:', 'Current effective period:', 'Official URL:', 'Current artifact SHA-256:', 'Estimated impact:', 'Required Product Owner action:', 'Timestamp:', 'Review package:']) {
      expect(sent[0].bodyText).toContain(required);
    }
  });

  it('stops only the email gate when the canonical destination is absent', async () => {
    const transport: CommunicationProviderPort = {
      channel: 'email',
      provider: 'test-email',
      configured: () => true,
      send: async () => { throw new Error('must not send'); },
    };
    const result = evaluateSourceFreshness(
      { ...nlSource, nextFreshnessCheck: null },
      { checkedAt: '2026-08-30T10:00:00.000Z', checkOutcome: 'CONFIRMED_CURRENT' },
    );
    const dispatched = await dispatchSourceAlertEmail({
      source: result.source,
      event: result.alerts[0],
      recipient: undefined,
      timestamp: '2026-08-30T10:00:00.000Z',
      reviewPackagePath: 'review.json',
      transport,
    });
    expect(dispatched.status).toBe('EMAIL_DESTINATION_NOT_CONFIGURED');
    expect(PRODUCT_OWNER_ALERT_EMAIL_ENV).toBe('AGM_PRODUCT_OWNER_ALERT_EMAIL');
  });

  it('parses and delivers one deduplicated alert batch to a configured recipient list', async () => {
    const result = evaluateSourceFreshness(
      { ...nlSource, nextFreshnessCheck: null },
      { checkedAt: '2026-08-30T10:00:00.000Z', checkOutcome: 'CONFIRMED_CURRENT' },
    );
    const sent: OutboundCommunication[] = [];
    const transport: CommunicationProviderPort = {
      channel: 'email',
      provider: 'test-email',
      configured: () => true,
      send: async (message) => {
        sent.push(message);
        return { providerMessageId: `test-${sent.length}`, status: 'sent' };
      },
    };
    const configuration = 'primary@example.test; secondary@example.test, PRIMARY@example.test';
    expect(parseProductOwnerAlertRecipients(configuration)).toEqual(['primary@example.test', 'secondary@example.test']);
    const dispatched = await dispatchSourceAlertEmails({
      source: result.source,
      event: result.alerts[0],
      recipientConfiguration: configuration,
      timestamp: '2026-08-30T10:00:00.000Z',
      reviewPackagePath: 'review.json',
      transport,
    });
    expect(dispatched.status).toBe('SENT');
    expect(dispatched.recipients).toHaveLength(2);
    expect(sent).toHaveLength(2);
    expect(new Set(sent.map((message) => message.clientMessageId)).size).toBe(2);
    expect(dispatched.ledgerEntry?.dedupKey).toBe(result.alerts[0].dedupKey);
  });

  it('proves Registry and Routing/Toll view match the authorized ROUTING-TOLL-001 atomic state', () => {
    const root = resolve(process.cwd(), '..', '..');
    const hash = (relative: string) => createHash('sha256').update(readFileSync(resolve(root, relative))).digest('hex');
    expect(hash('AGM_LIBRARY/REGISTRY/canonical-sources.json')).toBe('7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245');
    expect(hash('AGM_LIBRARY/VIEWS/legislation-safety.view.json')).toBe('c6d45d7c4fcc86574790add0491e37727691909f287d461e356be05f69a1b0ab');
    expect(hash('AGM_LIBRARY/VIEWS/routing-toll.view.json')).toBe('049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0');
  });
});
