import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { CommunicationProviderPort } from '../src/communications/communication-provider.port';
import { GmailCommunicationProvider } from '../src/communications/providers/gmail.provider';
import type { AlertLedgerEntry, SourceAlertEvent, SourceFreshnessRecord } from '../src/source-freshness/source-freshness.contract';
import { dispatchSourceAlertEmails, parseProductOwnerAlertRecipients } from '../src/source-freshness/source-freshness.email';
import { evaluateSourceFreshness, sourceAlertDedupKey } from '../src/source-freshness/source-freshness.engine';

const root = resolve(import.meta.dirname, '..', '..', '..');
const auditPath = resolve(root, 'evidence', 'production-release', 'gmail-source-freshness-controlled-test.json');
const expectedRecipients = [
  'agm.transporte.logistik@gmail.com',
  'adrianmuscalu2@gmail.com',
];
const effectiveVersion = 'RC-CONTROLLED-2026-08-30';

async function main() {
  const dryRun = process.env.AGM_SOURCE_ALERT_TEST_DRY_RUN === 'true';
  if (existsSync(auditPath)) {
    const previous = JSON.parse(await readFile(auditPath, 'utf8')) as { status?: string };
    if (previous.status === 'PASS') {
      console.log(JSON.stringify({ status: 'DEDUP_SUPPRESSED', auditPath, secretsPrinted: false }));
      return;
    }
  }

  const recipients = parseProductOwnerAlertRecipients(process.env.AGM_PRODUCT_OWNER_ALERT_EMAIL);
  assert.deepEqual(new Set(recipients), new Set(expectedRecipients));
  assert.equal(process.env.GMAIL_FROM_ADDRESS?.toLowerCase(), expectedRecipients[0]);

  const provider: CommunicationProviderPort = dryRun
    ? {
        channel: 'email',
        provider: 'controlled-dry-run',
        configured: () => true,
        send: async () => ({ providerMessageId: 'dry-run', status: 'sent' }),
      }
    : new GmailCommunicationProvider(new ConfigService(process.env));
  assert.equal(provider.configured(), true);
  const timestamp = new Date().toISOString();
  const source: SourceFreshnessRecord = {
    sourceId: 'RC-CONTROLLED-SOURCE-FRESHNESS-TEST',
    country: 'N/A',
    domain: 'RELEASE_ENGINEERING_TEST',
    authority: 'AGM Release Engineering (CONTROLLED TEST ONLY)',
    authorityClassification: 'CONTEXTUAL',
    title: 'Controlled source freshness email delivery test',
    officialUrl: 'https://agm-cockpit.eu/',
    effectiveFrom: null,
    effectiveUntil: null,
    version: effectiveVersion,
    capturedAt: timestamp,
    lastFreshnessCheck: null,
    nextFreshnessCheck: timestamp,
    sha256: '0'.repeat(64),
    currentStatus: 'CURRENT',
    supersedes: [],
    supersededBy: [],
    reviewRequired: false,
  };
  const dedupKey = sourceAlertDedupKey(source.sourceId, 'FRESHNESS_UNKNOWN', effectiveVersion);
  const event: SourceAlertEvent = {
    sourceId: source.sourceId,
    alertType: 'FRESHNESS_UNKNOWN',
    status: 'FRESHNESS_UNKNOWN',
    dedupKey,
    effectiveVersionOrDate: effectiveVersion,
    condition: '[CONTROLLED TEST — NO SOURCE STATE CHANGE] Gmail delivery and Product Owner routing validation.',
    impact: 'No product, Registry, view, authority, tariff, or production-data impact.',
    requiredProductOwnerAction: 'No action required; acknowledge this controlled release-engineering test only.',
  };

  const delivery = await dispatchSourceAlertEmails({
    source,
    event,
    recipientConfiguration: recipients.join(';'),
    timestamp,
    reviewPackagePath: 'evidence/production-release/gmail-source-freshness-controlled-test.json',
    transport: provider,
  });
  assert.equal(delivery.status, 'SENT');
  assert.deepEqual(new Set(delivery.recipients), new Set(expectedRecipients));
  assert.equal(delivery.emails.length, 2);
  assert.equal(new Set(delivery.emails.map((email) => email.clientMessageId)).size, 2);
  assert.ok(delivery.emails.every((email) => email.subject === `[AGM SOURCE ALERT] FRESHNESS_UNKNOWN — ${source.sourceId}`));
  assert.ok(delivery.ledgerEntry);

  const ledger: AlertLedgerEntry[] = [delivery.ledgerEntry];
  const repeatedEvaluation = evaluateSourceFreshness(
    source,
    { checkedAt: timestamp, checkOutcome: 'FAILED', checkFailureReason: event.condition },
    ledger,
  );
  assert.equal(repeatedEvaluation.alerts.length, 0);

  const audit = {
    schemaVersion: 1,
    status: 'PASS',
    testType: 'CONTROLLED_SOURCE_FRESHNESS_EMAIL',
    sentAt: timestamp,
    sender: expectedRecipients[0],
    recipients: delivery.recipients,
    sentEmailCount: delivery.emails.length,
    alertType: event.alertType,
    sourceId: source.sourceId,
    dedupKey,
    secondEvaluation: 'DEDUP_SUPPRESSED',
    registryMutation: 'NONE',
    viewMutation: 'NONE',
    authorityPromotion: 'NONE',
    productionDataMutation: 'NONE',
    secretsPrinted: false,
  };
  if (dryRun) {
    console.log(JSON.stringify({ ...audit, status: 'DRY_RUN_PASS', externalSend: false }));
    return;
  }
  await mkdir(dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(audit));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'SOURCE_FRESHNESS_EMAIL_EXTERNAL_TEST_FAILED');
  process.exitCode = 1;
});
