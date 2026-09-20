import type { AndroidActionKind, AndroidActionResolution } from '../android-action-layer/android-action.contract';
import { confirmationFor } from '../android-action-layer/confirmation-policy';
import type { AgmContact } from './contact-manager.types';
import type { ContactEmailAddress } from './contact-manager.types';
import { normalizeContactEmails, requestedContactEmailLabel, selectContactEmail } from './contact-email';

export type PersonalContactVoiceIntent = 'LOOKUP' | 'PHONE' | 'CALL' | 'EMAIL' | 'MESSENGER' | 'WHATSAPP';
export type PersonalContactVoiceResolution =
  | { handled: false }
  | { handled: true; intent: PersonalContactVoiceIntent; mode: 'LOOKUP' | 'ACTION' | 'CLARIFICATION';
      reason: 'AGM_PERSONAL_CONTACT_NAME_RESOLVED' | 'AGM_PERSONAL_CONTACT_IDENTITY_AMBIGUOUS'
        | 'AGM_PERSONAL_CONTACT_ACTION_REQUIRED' | 'AGM_PERSONAL_CONTACT_CHANNEL_MISSING'
        | 'AGM_PERSONAL_CONTACT_EMAIL_AMBIGUOUS' | 'AGM_PERSONAL_CONTACT_EMAIL_LABEL_NOT_FOUND'
        | 'AGM_PERSONAL_CONTACT_NEGATED_ACTION';
      contact?: AgmContact; requestedName: string; requestedChannel?: 'PHONE' | 'EMAIL' | 'MESSENGER' | 'WHATSAPP';
      requestedEmailLabel?: string; selectedEmail?: ContactEmailAddress; availableEmailLabels?: string[];
      resolution?: AndroidActionResolution };
type NameMatch = { contact: AgmContact; alias: string; queryName: string; score: number };

export function resolvePersonalContactVoiceRequest(text: string, contacts: AgmContact[]): PersonalContactVoiceResolution {
  const value = normalize(text);
  if (!value || contacts.length === 0) return { handled: false };
  const matches = strongestNameMatches(value, contacts);
  if (matches.length === 0) return { handled: false };
  const intent = inferIntent(value);
  const requestedChannel = channelForIntent(intent);
  const requestedName = matches[0]!.queryName;
  const availableEmailLabels = matches.flatMap((match) => normalizeContactEmails(match.contact.emails, match.contact.email).map((entry) => entry.label));
  const requestedEmailLabel = intent === 'EMAIL' ? requestedContactEmailLabel(text, availableEmailLabels) : undefined;
  const action = actionForIntent(intent, value);
  if (action && isNegated(value)) return { handled: true, intent, mode: 'CLARIFICATION', reason: 'AGM_PERSONAL_CONTACT_NEGATED_ACTION', requestedName, requestedChannel, ...(requestedEmailLabel ? { requestedEmailLabel } : {}) };
  if (action) return { handled: true, intent, mode: 'ACTION', reason: 'AGM_PERSONAL_CONTACT_NAME_RESOLVED', requestedName, requestedChannel,
    resolution: { contractVersion: 'android-action-resolution.v1', status: 'RESOLVED', action,
      reason: `AGM_PERSONAL_CONTACT_NAME_FIRST_${intent}`, source: 'REQUEST',
      payload: { contactName: matches.length === 1 ? matches[0]!.contact.name : requestedName, ...(requestedEmailLabel ? { requestedEmailLabel } : {}) }, confirmation: confirmationFor(action) },
    ...(requestedEmailLabel ? { requestedEmailLabel } : {}) };
  if (matches.length > 1) return { handled: true, intent, mode: 'CLARIFICATION', reason: 'AGM_PERSONAL_CONTACT_IDENTITY_AMBIGUOUS', requestedName, requestedChannel, ...(requestedEmailLabel ? { requestedEmailLabel } : {}) };
  const contact = matches[0]!.contact;
  if (intent === 'EMAIL') {
    const selected = selectContactEmail(contact, requestedEmailLabel);
    if (selected.status === 'MISSING') return { handled: true, intent, mode: 'CLARIFICATION', reason: 'AGM_PERSONAL_CONTACT_CHANNEL_MISSING', contact, requestedName: contact.name, requestedChannel, ...(requestedEmailLabel ? { requestedEmailLabel } : {}) };
    if (selected.status === 'LABEL_NOT_FOUND') return { handled: true, intent, mode: 'CLARIFICATION', reason: 'AGM_PERSONAL_CONTACT_EMAIL_LABEL_NOT_FOUND', contact, requestedName: contact.name, requestedChannel, requestedEmailLabel: selected.requestedLabel, availableEmailLabels: selected.availableLabels };
    if (selected.status === 'AMBIGUOUS') return { handled: true, intent, mode: 'CLARIFICATION', reason: 'AGM_PERSONAL_CONTACT_EMAIL_AMBIGUOUS', contact, requestedName: contact.name, requestedChannel, availableEmailLabels: selected.availableLabels };
    return { handled: true, intent, mode: 'LOOKUP', reason: 'AGM_PERSONAL_CONTACT_NAME_RESOLVED', contact, requestedName: contact.name, requestedChannel, requestedEmailLabel: selected.email.label, selectedEmail: selected.email, availableEmailLabels: selected.availableLabels };
  }
  if (requestedChannel && !channelValue(contact, requestedChannel)) return { handled: true, intent, mode: 'CLARIFICATION', reason: 'AGM_PERSONAL_CONTACT_CHANNEL_MISSING', contact, requestedName: contact.name, requestedChannel };
  if (intent === 'LOOKUP' && !hasExplicitLookupCue(value)) return { handled: true, intent, mode: 'CLARIFICATION', reason: 'AGM_PERSONAL_CONTACT_ACTION_REQUIRED', contact, requestedName: contact.name };
  return { handled: true, intent, mode: 'LOOKUP', reason: 'AGM_PERSONAL_CONTACT_NAME_RESOLVED', contact, requestedName: contact.name, requestedChannel };
}

function strongestNameMatches(value: string, contacts: AgmContact[]): NameMatch[] {
  const matches = contacts.flatMap((contact) => aliasesFor(contact.name).flatMap((entry) => containsPhrase(value, entry.alias) ? [{ contact, ...entry }] : []));
  const strongestByContact = new Map<string, NameMatch>();
  for (const match of matches) { const current = strongestByContact.get(match.contact.id); if (!current || match.score > current.score) strongestByContact.set(match.contact.id, match); }
  const strongest = [...strongestByContact.values()];
  const maxScore = Math.max(0, ...strongest.map((match) => match.score));
  return strongest.filter((match) => match.score === maxScore);
}
function aliasesFor(name: string) {
  const normalized = normalize(name); const parts = normalized.split(' ').filter(Boolean); if (!parts.length) return [];
  const first = parts[0]!; const displayFirst = name.trim().split(/\s+/)[0] || first; const aliases = new Map<string, { alias: string; queryName: string; score: number }>();
  const add = (alias: string, queryName: string, score: number) => { if (alias.length >= 3) aliases.set(alias, { alias, queryName, score }); };
  add(normalized, name.trim(), 300 + normalized.length); add(first, displayFirst, 100 + first.length);
  const genitive = first.endsWith('a') && first.length > 2 ? `${first.slice(0, -1)}ei` : '';
  if (genitive) { add([genitive, ...parts.slice(1)].join(' '), name.trim(), 300 + normalized.length); add(genitive, displayFirst, 100 + first.length); }
  return [...aliases.values()];
}
function inferIntent(value: string): PersonalContactVoiceIntent {
  if (/\b(?:whatsapp|what s app)\b/.test(value)) return 'WHATSAPP';
  if (/\bmessenger\b/.test(value)) return 'MESSENGER';
  if (hasCallCue(value)) return 'CALL';
  if (/\b(?:e mail|email|emailul|gmail|mail|mailul)\b/.test(value) || hasWritingCue(value)) return 'EMAIL';
  if (/\b(?:telefon|telefonul|numar|numarul|phone|number|nummer)\b/.test(value)) return 'PHONE';
  return 'LOOKUP';
}
function actionForIntent(intent: PersonalContactVoiceIntent, value: string): AndroidActionKind | undefined { if (intent === 'CALL') return 'DIAL'; if (intent === 'EMAIL' && hasWritingCue(value)) return 'EMAIL_DRAFT'; if (intent === 'MESSENGER' && hasExternalActionCue(value)) return 'MESSENGER_CHAT'; return undefined; }
function hasCallCue(value: string) { return /\b(?:suna|sun o|sunati|apeleaza|apeleaz o|formeaza|dial|call|anrufen|ruf)\b/.test(value); }
function hasWritingCue(value: string) { return /\b(?:trimite|trimiti|trimite i|scrie|scrie i|compune|send|write|compose|sende|schreibe)\b/.test(value); }
function hasExternalActionCue(value: string) { return hasCallCue(value) || hasWritingCue(value) || /\b(?:deschide|porneste|open|launch|offne|starte)\b/.test(value); }
function hasExplicitLookupCue(value: string) { return /\b(?:contact|contactul|biblioteca|bibliotec|profil|date|datele|detalii|acceseaza|gaseste|cauta|find|lookup|details)\b/.test(value); }
function isNegated(value: string) { return /\b(?:nu|not|don t|do not|nicht|kein|keine)\b/.test(value); }
function channelForIntent(intent: PersonalContactVoiceIntent) { if (intent === 'PHONE' || intent === 'CALL') return 'PHONE' as const; if (intent === 'EMAIL') return 'EMAIL' as const; if (intent === 'MESSENGER') return 'MESSENGER' as const; if (intent === 'WHATSAPP') return 'WHATSAPP' as const; return undefined; }
function channelValue(contact: AgmContact, channel: NonNullable<ReturnType<typeof channelForIntent>>) { if (channel === 'PHONE') return contact.phone.trim(); if (channel === 'EMAIL') return selectContactEmail(contact).status === 'RESOLVED'; if (channel === 'MESSENGER') return contact.messenger.trim(); return contact.whatsapp.trim(); }
function containsPhrase(value: string, phrase: string) { return ` ${value} `.includes(` ${phrase} `); }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
