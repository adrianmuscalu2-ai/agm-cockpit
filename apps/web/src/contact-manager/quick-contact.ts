import type { AgmContact, ContactDraft, ContactValidationResult } from './contact-manager.types';
import type { AndroidActionResolution } from '../android-action-layer/android-action.contract';

export const QUICK_CONTACT_LIMIT = 20;

export type QuickContactChannel = 'email' | 'phone' | 'messenger';

export function quickContactCounts(contacts: AgmContact[]): Record<QuickContactChannel, number> {
  return {
    email: contacts.filter((contact) => Boolean(contact.email.trim())).length,
    phone: contacts.filter((contact) => Boolean(contact.phone.trim())).length,
    messenger: contacts.filter((contact) => Boolean(contact.messenger.trim())).length,
  };
}

export function validateQuickContactCapacity(
  contacts: AgmContact[],
  draft: ContactDraft,
  editingId = '',
): ContactValidationResult {
  const others = editingId ? contacts.filter((contact) => contact.id !== editingId) : contacts;
  const counts = quickContactCounts(others);
  const messages: string[] = [];
  for (const channel of ['email', 'phone', 'messenger'] as const) {
    if (draft[channel].trim() && counts[channel] >= QUICK_CONTACT_LIMIT) {
      messages.push(`contact.validation.limit.${channel}`);
    }
  }
  return { valid: messages.length === 0, messages };
}

export function resolveQuickContactAction(
  resolution: AndroidActionResolution,
  contacts: AgmContact[],
): AndroidActionResolution {
  if (resolution.status !== 'RESOLVED' || !resolution.action || !resolution.payload?.contactName) return resolution;
  const channel = channelForAction(resolution.action);
  if (!channel) return resolution;
  const matches = findNamedContacts(contacts, resolution.payload.contactName).filter((contact) => Boolean(contact[channel].trim()));
  if (matches.length === 1) {
    return {
      ...resolution,
      reason: `QUICK_CONTACT_${channel.toUpperCase()}_RESOLVED`,
      payload: { ...resolution.payload, value: matches[0]![channel].trim() },
    };
  }
  if (matches.length > 1) {
    return { ...resolution, status: 'CLARIFICATION_REQUIRED', reason: 'QUICK_CONTACT_AMBIGUOUS', source: 'NONE', confirmation: 'NONE' };
  }
  if (resolution.action === 'DIAL') return resolution;
  return { ...resolution, status: 'CLARIFICATION_REQUIRED', reason: 'QUICK_CONTACT_NOT_FOUND', source: 'NONE', confirmation: 'NONE' };
}

function channelForAction(action: NonNullable<AndroidActionResolution['action']>): QuickContactChannel | null {
  if (action === 'DIAL') return 'phone';
  if (action === 'EMAIL_DRAFT') return 'email';
  if (action === 'MESSENGER_CHAT') return 'messenger';
  return null;
}

function findNamedContacts(contacts: AgmContact[], requestedName: string) {
  const needle = normalizeName(requestedName);
  const candidates = contacts.filter((contact) => {
    const values = [contact.name, contact.company].map(normalizeName).filter(Boolean);
    return values.some((value) => value === needle);
  });
  if (candidates.length > 0) return candidates;
  return contacts.filter((contact) => normalizeName(contact.name).startsWith(`${needle} `));
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
