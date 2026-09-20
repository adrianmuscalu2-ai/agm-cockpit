import type { AgmContact, ContactEmailAddress } from './contact-manager.types';

export type ContactEmailSelection =
  | { status: 'RESOLVED'; email: ContactEmailAddress; availableLabels: string[] }
  | { status: 'MISSING'; availableLabels: string[] }
  | { status: 'LABEL_NOT_FOUND'; requestedLabel: string; availableLabels: string[] }
  | { status: 'AMBIGUOUS'; availableLabels: string[] };

export function emptyContactEmailRows(): ContactEmailAddress[] {
  return [
    newContactEmailRow('personal', true),
    newContactEmailRow('work'),
  ];
}

export function newContactEmailRow(label = '', isDefault = false, value = ''): ContactEmailAddress {
  return { id: emailId(), label, value, isDefault };
}

export function normalizeContactEmails(value: unknown, legacyEmail = ''): ContactEmailAddress[] {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object') return [];
    const candidate = row as Partial<ContactEmailAddress>;
    const email = String(candidate.value ?? '').trim();
    if (!email) return [];
    return [{
      id: String(candidate.id || emailId()),
      label: String(candidate.label || `email-${index + 1}`).trim() || `email-${index + 1}`,
      value: email,
      isDefault: Boolean(candidate.isDefault),
    }];
  });
  if (!normalized.length && legacyEmail.trim()) {
    normalized.push({ id: emailId(), label: 'email', value: legacyEmail.trim(), isDefault: true });
  }
  const seen = new Set<string>();
  const unique = normalized.filter((row) => {
    const key = row.value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const defaultIndex = unique.findIndex((row) => row.isDefault);
  return unique.map((row, index) => ({ ...row, isDefault: defaultIndex >= 0 ? index === defaultIndex : false }));
}

export function primaryContactEmail(contact: Pick<AgmContact, 'email' | 'emails'>): string {
  const rows = normalizeContactEmails(contact.emails, contact.email);
  return (rows.find((row) => row.isDefault) ?? rows[0])?.value ?? '';
}

export function selectContactEmail(
  contact: Pick<AgmContact, 'email' | 'emails'>,
  requestedLabel?: string,
): ContactEmailSelection {
  const rows = normalizeContactEmails(contact.emails, contact.email);
  const availableLabels = rows.map((row) => row.label);
  if (!rows.length) return { status: 'MISSING', availableLabels };
  if (requestedLabel?.trim()) {
    const key = emailLabelKey(requestedLabel);
    const matches = rows.filter((row) => emailLabelKey(row.label) === key);
    if (matches.length === 1) return { status: 'RESOLVED', email: matches[0]!, availableLabels };
    if (matches.length > 1) return { status: 'AMBIGUOUS', availableLabels };
    return { status: 'LABEL_NOT_FOUND', requestedLabel, availableLabels };
  }
  const defaults = rows.filter((row) => row.isDefault);
  if (defaults.length === 1) return { status: 'RESOLVED', email: defaults[0]!, availableLabels };
  if (rows.length === 1) return { status: 'RESOLVED', email: rows[0]!, availableLabels };
  return { status: 'AMBIGUOUS', availableLabels };
}

export function requestedContactEmailLabel(text: string, availableLabels: readonly string[] = []): string | undefined {
  const value = normalize(text);
  if (/\b(?:personal|personala|personale|privat|privata|private)\b/.test(value)) return matchCanonicalLabel('personal', availableLabels) ?? 'personal';
  if (/\b(?:serviciu|munca|profesional|profesionala|business|work|office|dienstlich|arbeit)\b/.test(value)) return matchCanonicalLabel('work', availableLabels) ?? 'work';
  return availableLabels.find((label) => containsPhrase(value, emailLabelKey(label)));
}

export function emailLabelKey(value: string) {
  const key = normalize(value);
  if (/^(?:personal|personala|personale|privat|privata|private)$/.test(key)) return 'personal';
  if (/^(?:serviciu|munca|profesional|profesionala|business|work|office|dienstlich|arbeit)$/.test(key)) return 'work';
  return key;
}

function matchCanonicalLabel(key: string, labels: readonly string[]) {
  return labels.find((label) => emailLabelKey(label) === key);
}

function containsPhrase(value: string, phrase: string) {
  return Boolean(phrase) && ` ${value} `.includes(` ${phrase} `);
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function emailId() {
  return globalThis.crypto?.randomUUID?.() ?? `email-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
