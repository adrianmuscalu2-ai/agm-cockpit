import type { AgmContact, ContactDraft, ContactValidationResult } from './contact-manager.types';
import type { AndroidActionResolution } from '../android-action-layer/android-action.contract';
import { normalizeContactEmails, selectContactEmail } from './contact-email';

export const PERSONAL_CONTACT_LIMIT = 20;

export type PersonalContactChannel = 'email' | 'phone' | 'messenger';

export type PersonalContactCounts = Record<PersonalContactChannel, number> & { people: number };

export function personalContactCounts(contacts: AgmContact[]): PersonalContactCounts {
  return {
    people: contacts.length,
    email: contacts.filter((contact) => normalizeContactEmails(contact.emails, contact.email).length > 0).length,
    phone: contacts.filter((contact) => Boolean(contact.phone.trim())).length,
    messenger: contacts.filter((contact) => Boolean(contact.messenger.trim())).length,
  };
}

export function validatePersonalContactCollection(
  contacts: AgmContact[],
  draft: ContactDraft,
  editingId = '',
): ContactValidationResult {
  const others = editingId ? contacts.filter((contact) => contact.id !== editingId) : contacts;
  const messages: string[] = [];
  if (!editingId && others.length >= PERSONAL_CONTACT_LIMIT) {
    messages.push('contact.validation.limit.person');
  }
  if (others.some((contact) => isSameStoredPerson(contact, draft))) {
    messages.push('contact.validation.duplicatePerson');
  }
  return { valid: messages.length === 0, messages };
}

export function resolvePersonalContactAction(
  resolution: AndroidActionResolution,
  contacts: AgmContact[],
): AndroidActionResolution {
  if (resolution.status !== 'RESOLVED' || !resolution.action || !resolution.payload?.contactName) return resolution;
  const channel = channelForAction(resolution.action);
  if (!channel) return resolution;
  const matches = findNamedContacts(contacts, resolution.payload.contactName);
  const requestedChannel = channel.toUpperCase() as 'EMAIL' | 'PHONE' | 'MESSENGER';
  if (matches.length > 1) {
    return {
      ...resolution,
      status: 'CLARIFICATION_REQUIRED',
      reason: 'AGM_PERSONAL_CONTACT_AMBIGUOUS',
      source: 'NONE',
      confirmation: 'NONE',
      payload: { ...resolution.payload, contactName: matches[0]?.name.trim() || resolution.payload.contactName, requestedChannel },
    };
  }
  if (matches.length === 1) {
    const contact = matches[0]!;
    if (channel === 'email') {
      const requestedEmailLabel = resolution.payload?.requestedEmailLabel;
      const selected = selectContactEmail(contact, requestedEmailLabel);
      if (selected.status !== 'RESOLVED') {
        const reason = selected.status === 'AMBIGUOUS'
          ? 'AGM_PERSONAL_CONTACT_EMAIL_AMBIGUOUS'
          : selected.status === 'LABEL_NOT_FOUND'
            ? 'AGM_PERSONAL_CONTACT_EMAIL_LABEL_NOT_FOUND'
            : 'AGM_PERSONAL_CONTACT_CHANNEL_MISSING';
        return {
          ...resolution,
          status: 'CLARIFICATION_REQUIRED',
          reason,
          source: 'NONE',
          confirmation: 'NONE',
          payload: {
            ...resolution.payload,
            contactId: contact.id,
            contactName: contact.name.trim(),
            requestedChannel,
            ...(requestedEmailLabel ? { requestedEmailLabel } : {}),
            availableEmailLabels: selected.availableLabels,
          },
        };
      }
      return {
        ...resolution,
        reason: 'AGM_PERSONAL_CONTACT_EMAIL_RESOLVED',
        payload: {
          ...resolution.payload,
          contactId: contact.id,
          contactName: contact.name.trim(),
          contactSource: 'AGM_PERSONAL_CONTACTS',
          requestedChannel,
          requestedEmailLabel: selected.email.label,
          selectedEmailLabel: selected.email.label,
          availableEmailLabels: selected.availableLabels,
          value: selected.email.value,
        },
      };
    }
    const value = contact[channel].trim();
    if (!value) {
      return {
        ...resolution,
        status: 'CLARIFICATION_REQUIRED',
        reason: 'AGM_PERSONAL_CONTACT_CHANNEL_MISSING',
        source: 'NONE',
        confirmation: 'NONE',
        payload: { ...resolution.payload, contactId: contact.id, contactName: contact.name.trim(), requestedChannel },
      };
    }
    return {
      ...resolution,
      reason: `AGM_PERSONAL_CONTACT_${requestedChannel}_RESOLVED`,
      payload: {
        ...resolution.payload,
        contactId: contact.id,
        contactName: contact.name.trim(),
        contactSource: 'AGM_PERSONAL_CONTACTS',
        requestedChannel,
        value,
      },
    };
  }
  if (resolution.action === 'DIAL') return resolution;
  return {
    ...resolution,
    status: 'CLARIFICATION_REQUIRED',
    reason: 'AGM_PERSONAL_CONTACT_NOT_FOUND',
    source: 'NONE',
    confirmation: 'NONE',
    payload: { ...resolution.payload, requestedChannel },
  };
}

function channelForAction(action: NonNullable<AndroidActionResolution['action']>): PersonalContactChannel | null {
  if (action === 'DIAL') return 'phone';
  if (action === 'EMAIL_DRAFT') return 'email';
  if (action === 'MESSENGER_CHAT') return 'messenger';
  return null;
}

function findNamedContacts(contacts: AgmContact[], requestedName: string) {
  const needle = normalizeName(requestedName);
  const exact = contacts.filter((contact) => {
    const values = [contact.name, contact.company].map(normalizeName).filter(Boolean);
    return values.some((value) => value === needle);
  });
  if (exact.length > 0) return exact;
  return contacts.filter((contact) => normalizeName(contact.name).startsWith(`${needle} `));
}

function isSameStoredPerson(contact: AgmContact, draft: ContactDraft) {
  const name = normalizeName(draft.name);
  if (!name || normalizeName(contact.name) !== name) return false;
  const channels = ['phone', 'whatsapp', 'messenger'] as const;
  const draftIdentifiers = [
    ...channels.map((channel) => normalizeIdentifier(draft[channel])),
    ...normalizeContactEmails(draft.emails, draft.email).map((entry) => normalizeIdentifier(entry.value)),
  ].filter(Boolean);
  const existingIdentifiers = [
    ...channels.map((channel) => normalizeIdentifier(contact[channel])),
    ...normalizeContactEmails(contact.emails, contact.email).map((entry) => normalizeIdentifier(entry.value)),
  ].filter(Boolean);
  if (draftIdentifiers.length === 0 && existingIdentifiers.length === 0) return true;
  return draftIdentifiers.some((identifier) => existingIdentifiers.includes(identifier));
}

function normalizeIdentifier(value: string) {
  return value.toLocaleLowerCase().replace(/[\s()+.\/-]+/g, '').trim();
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
