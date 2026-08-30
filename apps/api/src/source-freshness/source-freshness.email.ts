import { createHash } from 'node:crypto';
import type { CommunicationProviderPort } from '../communications/communication-provider.port';
import type { OutboundCommunication } from '../communications/communication.contract';
import type {
  AlertLedgerEntry,
  EmailAlertGateStatus,
  SourceAlertBatchDelivery,
  SourceAlertEmail,
  SourceAlertEvent,
  SourceFreshnessRecord,
} from './source-freshness.contract';

export const PRODUCT_OWNER_ALERT_EMAIL_ENV = 'AGM_PRODUCT_OWNER_ALERT_EMAIL';

export function parseProductOwnerAlertRecipients(value?: string | null) {
  if (!value?.trim()) return [];
  const recipients = [...new Set(value.split(/[,;]/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
  if (recipients.some((recipient) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient))) {
    throw new Error('PRODUCT_OWNER_ALERT_EMAIL_INVALID');
  }
  return recipients;
}

export function buildSourceAlertEmail(
  source: SourceFreshnessRecord,
  event: SourceAlertEvent,
  recipient: string,
  timestamp: string,
  reviewPackagePath: string,
): SourceAlertEmail {
  const candidate = event.detectedCandidate;
  const effectivePeriod = `${source.effectiveFrom ?? 'NOT_EXPLICIT'} -> ${source.effectiveUntil ?? 'NOT_EXPLICIT'}`;
  return {
    to: recipient.trim().toLowerCase(),
    subject: `[AGM SOURCE ALERT] ${event.status} — ${source.sourceId}`,
    bodyText: [
      `SourceId: ${source.sourceId}`,
      `Country / domain: ${source.country} / ${source.domain}`,
      `Authority: ${source.authority}`,
      `Source title: ${source.title}`,
      `Current effective period: ${effectivePeriod}`,
      `Detected new version / expiry condition: ${event.condition}`,
      `Official URL: ${source.officialUrl}`,
      `Current artifact SHA-256: ${source.sha256}`,
      `New candidate URL/version: ${candidate ? `${candidate.officialUrl} / ${candidate.version ?? 'VERSION_NOT_EXPLICIT'}` : 'N/A'}`,
      `Estimated impact: ${event.impact}`,
      `Required Product Owner action: ${event.requiredProductOwnerAction}`,
      `Timestamp: ${timestamp}`,
      `Review package: ${reviewPackagePath}`,
    ].join('\n'),
    clientMessageId: deterministicUuid(`${event.dedupKey}|${recipient.trim().toLowerCase()}`),
    dedupKey: event.dedupKey,
  };
}

export async function dispatchSourceAlertEmails(input: {
  source: SourceFreshnessRecord;
  event: SourceAlertEvent;
  recipientConfiguration?: string | null;
  timestamp: string;
  reviewPackagePath: string;
  transport: CommunicationProviderPort;
}): Promise<SourceAlertBatchDelivery> {
  const recipients = parseProductOwnerAlertRecipients(input.recipientConfiguration);
  if (!recipients.length) return { status: 'EMAIL_DESTINATION_NOT_CONFIGURED', recipients, emails: [] };
  if (!input.transport.configured()) return { status: 'EMAIL_TRANSPORT_NOT_CONFIGURED', recipients, emails: [] };

  const emails: SourceAlertEmail[] = [];
  for (const recipient of recipients) {
    const email = buildSourceAlertEmail(input.source, input.event, recipient, input.timestamp, input.reviewPackagePath);
    await input.transport.send({
      contractVersion: 'communication-message.v1',
      clientMessageId: email.clientMessageId,
      channel: 'email',
      to: email.to,
      subject: email.subject,
      bodyText: email.bodyText,
    });
    emails.push(email);
  }

  return {
    status: 'SENT',
    recipients,
    emails,
    ledgerEntry: {
      dedupKey: input.event.dedupKey,
      sourceId: input.source.sourceId,
      alertType: input.event.alertType,
      status: input.event.status,
      sentAt: input.timestamp,
    },
  };
}

export async function dispatchSourceAlertEmail(input: {
  source: SourceFreshnessRecord;
  event: SourceAlertEvent;
  recipient?: string | null;
  timestamp: string;
  reviewPackagePath: string;
  transport: CommunicationProviderPort;
}): Promise<{ status: EmailAlertGateStatus; ledgerEntry?: AlertLedgerEntry; email?: SourceAlertEmail }> {
  if (!input.recipient?.trim()) return { status: 'EMAIL_DESTINATION_NOT_CONFIGURED' };
  if (!input.transport.configured()) return { status: 'EMAIL_TRANSPORT_NOT_CONFIGURED' };
  const email = buildSourceAlertEmail(
    input.source,
    input.event,
    input.recipient,
    input.timestamp,
    input.reviewPackagePath,
  );
  const outbound: OutboundCommunication = {
    contractVersion: 'communication-message.v1',
    clientMessageId: email.clientMessageId,
    channel: 'email',
    to: email.to,
    subject: email.subject,
    bodyText: email.bodyText,
  };
  await input.transport.send(outbound);
  return {
    status: 'SENT',
    email,
    ledgerEntry: {
      dedupKey: input.event.dedupKey,
      sourceId: input.source.sourceId,
      alertType: input.event.alertType,
      status: input.event.status,
      sentAt: input.timestamp,
    },
  };
}

function deterministicUuid(value: string) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const compact = hex.join('');
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}
