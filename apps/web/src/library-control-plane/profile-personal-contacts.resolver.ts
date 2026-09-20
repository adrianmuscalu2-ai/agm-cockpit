import {
  AgmGlobalLibraryAuthority,
  createDomainOrchestrators,
  ExplicitLibraryAuthorizationPolicy,
  type AgmLibraryDomain,
  type AgmRequestSurface,
  type LibraryRequest,
  type LibraryResolver,
  type LibraryResolverResult,
  type ResolvedContextPackage,
} from '@agm/library-control-plane';
import type { AndroidActionResolution } from '../android-action-layer/android-action.contract';
import { readContacts } from '../contact-manager/contact-manager.storage';
import type { AgmContact, ContactStorage } from '../contact-manager/contact-manager.types';
import { resolvePersonalContactAction } from '../contact-manager/personal-contact';
import {
  resolvePersonalContactVoiceRequest,
  type PersonalContactVoiceIntent,
  type PersonalContactVoiceResolution,
} from '../contact-manager/personal-contact-voice';

const PROFILE_OWNER_ROLE = 'AGM_PROFILE_OWNER';
const PROFILE_CONTACT_PAYLOAD = 'contactCommand';
const CONTACT_DOMAINS: readonly AgmLibraryDomain[] = ['BASIC', 'PREMIUM', 'PROFILE', 'CAR_MOVER'];

type SafeContact = Pick<AgmContact, 'id' | 'name' | 'email' | 'emails' | 'phone' | 'whatsapp' | 'messenger' | 'updatedAt'>;

export type ProfileContactCommand = {
  intent: PersonalContactVoiceIntent;
  mode: 'LOOKUP' | 'ACTION' | 'CLARIFICATION';
  reason: Extract<PersonalContactVoiceResolution, { handled: true }>['reason'];
  requestedName: string;
  requestedChannel?: 'PHONE' | 'EMAIL' | 'MESSENGER' | 'WHATSAPP';
  requestedEmailLabel?: string;
  selectedEmail?: Extract<PersonalContactVoiceResolution, { handled: true }>['selectedEmail'];
  availableEmailLabels?: string[];
  contact?: SafeContact;
  resolution?: AndroidActionResolution;
};

export type ProfileContactLibraryResolution = {
  package: ResolvedContextPackage;
  command: PersonalContactVoiceResolution;
};

export class ProfilePersonalContactsResolver implements LibraryResolver {
  readonly descriptor = {
    resolverId: 'agm.profile.personal-contacts.v1',
    source: 'PROFILE_CONTACTS' as const,
    owner: 'AGM_PROFILE_USER_DATA',
    supportedDomains: CONTACT_DOMAINS,
    sensitivity: 'PERSONAL' as const,
    authorizationAction: 'library:read:own-profile-contacts',
  };

  constructor(private readonly contacts: () => AgmContact[], private readonly now = () => new Date().toISOString()) {}

  match(request: LibraryRequest) {
    return {
      eligible: true,
      confidence: 0.5,
      intent: request.query.intentHints?.[0] ?? 'PROFILE_CONTACT_DISCOVERY',
      ...(request.query.subjectHints?.[0] ? { subject: request.query.subjectHints[0] } : {}),
    };
  }

  async resolve(input: Parameters<LibraryResolver['resolve']>[0]): Promise<LibraryResolverResult> {
    const contacts = this.contacts();
    const voice = resolvePersonalContactVoiceRequest(input.request.query.text, contacts);
    if (!voice.handled) return noDataResult(input.request.query.text, this.now());

    const effectiveResolution = voice.resolution ? resolvePersonalContactAction(voice.resolution, contacts) : undefined;
    const command: ProfileContactCommand = {
      intent: voice.intent,
      mode: voice.mode,
      reason: voice.reason,
      requestedName: voice.requestedName,
      ...(voice.requestedChannel ? { requestedChannel: voice.requestedChannel } : {}),
      ...(voice.requestedEmailLabel ? { requestedEmailLabel: voice.requestedEmailLabel } : {}),
      ...(voice.selectedEmail ? { selectedEmail: voice.selectedEmail } : {}),
      ...(voice.availableEmailLabels ? { availableEmailLabels: voice.availableEmailLabels } : {}),
      ...(voice.contact ? { contact: safeContact(voice.contact) } : {}),
      ...(effectiveResolution ? { resolution: effectiveResolution } : {}),
    };
    const clarificationRequired = voice.reason !== 'AGM_PERSONAL_CONTACT_NEGATED_ACTION'
      && (voice.mode === 'CLARIFICATION' || effectiveResolution?.status === 'CLARIFICATION_REQUIRED');
    const candidateIds = candidateContactIds(contacts, voice.requestedName, voice.contact?.id);
    const selectedId = voice.contact?.id ?? effectiveResolution?.payload?.contactId ?? null;
    const timestamp = voice.contact?.updatedAt || this.now();
    return {
      status: clarificationRequired ? 'AMBIGUOUS' : 'FOUND',
      identity: { subjectType: 'PROFILE_PERSON', subjectId: selectedId, displayName: voice.contact?.name ?? voice.requestedName },
      query: { intent: voice.intent, normalizedText: normalize(input.request.query.text) },
      result: { summary: clarificationRequired ? 'PROFILE_CONTACT_CLARIFICATION_REQUIRED' : 'PROFILE_CONTACT_RESOLVED', recordCount: clarificationRequired ? Math.max(1, candidateIds.length) : 1 },
      confidence: clarificationRequired ? 0.75 : 1,
      ambiguity: {
        ambiguous: clarificationRequired,
        candidateIds,
        ...(clarificationRequired ? { clarificationPrompt: voice.reason } : {}),
      },
      provenance: {
        sourceRecordId: selectedId ? `profile-contact:${selectedId}` : `profile-contact-query:${normalize(voice.requestedName)}`,
        owner: 'AGM_PROFILE_USER_DATA',
        namespace: 'AGM_SHARED_PROFILE/contacts',
        evidenceRefs: [`profile-contact-store:${contacts.length}`],
      },
      freshness: { status: 'CURRENT', observedAt: timestamp, expiresAt: null },
      minimalAuthorizedPayload: { [PROFILE_CONTACT_PAYLOAD]: command },
      deduplicationKey: selectedId ? `profile-person:${selectedId}` : `profile-person-name:${normalize(voice.requestedName)}`,
    };
  }
}

export async function resolveProfilePersonalContactThroughAuthority(input: {
  text: string;
  language: string;
  storage: ContactStorage;
  surface: AgmRequestSurface;
  domain: AgmLibraryDomain;
  requestId?: string;
}): Promise<ProfileContactLibraryResolution> {
  const orchestrators = createDomainOrchestrators();
  const resolver = new ProfilePersonalContactsResolver(() => readContacts(input.storage));
  for (const orchestrator of orchestrators) orchestrator.register(resolver);
  const policy = new ExplicitLibraryAuthorizationPolicy(CONTACT_DOMAINS.map((domain) => ({
    role: PROFILE_OWNER_ROLE,
    domain,
    source: 'PROFILE_CONTACTS' as const,
    allowedPayloadFields: [PROFILE_CONTACT_PAYLOAD],
  })), 'profile-contacts.phase2a');
  const authority = new AgmGlobalLibraryAuthority(orchestrators, policy);
  const requestId = input.requestId ?? safeRequestId();
  const resolved = await authority.resolve({
    requestId,
    correlationId: `profile-contact:${requestId}`,
    surface: input.surface,
    activeDomain: input.domain,
    requestedDomains: [input.domain],
    identity: { tenantId: 'agm-local-profile-origin', subjectId: 'current-profile-owner', roles: [PROFILE_OWNER_ROLE] },
    query: { text: input.text, language: input.language },
  });
  const payload = resolved.contexts[0]?.minimalAuthorizedPayload[PROFILE_CONTACT_PAYLOAD]
    ?? resolved.clarifications[0]?.minimalAuthorizedPayload[PROFILE_CONTACT_PAYLOAD];
  return { package: resolved, command: isProfileContactCommand(payload) ? restoreVoiceCommand(payload) : { handled: false } };
}

function noDataResult(text: string, observedAt: string): LibraryResolverResult {
  return {
    status: 'NO_DATA',
    identity: { subjectType: 'PROFILE_PERSON', subjectId: null },
    query: { intent: 'PROFILE_CONTACT_DISCOVERY', normalizedText: normalize(text) },
    result: { summary: 'PROFILE_CONTACT_NOT_REFERENCED', recordCount: 0 },
    confidence: 1,
    ambiguity: { ambiguous: false, candidateIds: [] },
    provenance: { sourceRecordId: 'profile-contacts', owner: 'AGM_PROFILE_USER_DATA', namespace: 'AGM_SHARED_PROFILE/contacts', evidenceRefs: [] },
    freshness: { status: 'CURRENT', observedAt, expiresAt: null },
    minimalAuthorizedPayload: {},
    deduplicationKey: 'profile-contact:no-data',
  };
}

function safeContact(contact: AgmContact): SafeContact {
  return { id: contact.id, name: contact.name, email: contact.email, emails: contact.emails.map((entry) => ({ ...entry })), phone: contact.phone, whatsapp: contact.whatsapp, messenger: contact.messenger, updatedAt: contact.updatedAt };
}

function restoreVoiceCommand(command: ProfileContactCommand): PersonalContactVoiceResolution {
  const contact = command.contact ? {
    ...command.contact,
    company: '', address: '', notes: '', categories: [], favorite: false, createdAt: command.contact.updatedAt,
  } satisfies AgmContact : undefined;
  return {
    handled: true,
    intent: command.intent,
    mode: command.mode,
    reason: command.reason,
    requestedName: command.requestedName,
    ...(command.requestedChannel ? { requestedChannel: command.requestedChannel } : {}),
    ...(command.requestedEmailLabel ? { requestedEmailLabel: command.requestedEmailLabel } : {}),
    ...(command.selectedEmail ? { selectedEmail: command.selectedEmail } : {}),
    ...(command.availableEmailLabels ? { availableEmailLabels: command.availableEmailLabels } : {}),
    ...(contact ? { contact } : {}),
    ...(command.resolution ? { resolution: command.resolution } : {}),
  };
}

function isProfileContactCommand(value: unknown): value is ProfileContactCommand {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProfileContactCommand>;
  return typeof candidate.intent === 'string' && typeof candidate.mode === 'string'
    && typeof candidate.reason === 'string' && typeof candidate.requestedName === 'string';
}

function candidateContactIds(contacts: AgmContact[], requestedName: string, selectedId?: string) {
  const needle = normalize(requestedName);
  const matches = contacts.filter((contact) => {
    const name = normalize(contact.name);
    return name === needle || name.startsWith(`${needle} `) || normalize(contact.company) === needle;
  }).map((contact) => contact.id);
  if (selectedId && !matches.includes(selectedId)) matches.push(selectedId);
  return matches;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function safeRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `profile-contact-${Date.now()}`;
}
