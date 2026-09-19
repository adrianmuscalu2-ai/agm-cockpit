import { createHash } from 'node:crypto';
import type {
  AgmLibraryDomain,
  AgmLibrarySourceId,
  LibraryRequest,
  LibraryResolver,
  LibraryResolverResult,
  ResolvedContextPackage,
} from '@agm/library-control-plane';
import type { RequestContext } from '../common/request-context';
import type { AssistantSourceReference } from '../premium-assistant/premium-assistant.contract';
import type { CarMoverLibraryRecord, CarMoverLibraryRepositoryPort } from './car-mover-library.repository';

export const CAR_MOVER_LIBRARY_RESOLVERS = {
  transport: 'agm.car-mover.transport-history.v1',
  quote: 'agm.car-mover.quote-history.v1',
  client: 'agm.car-mover.client.v1',
  vehicle: 'agm.car-mover.vehicle.v1',
  route: 'agm.car-mover.route.v1',
  platform: 'agm.car-mover.platform.v1',
  cost: 'agm.car-mover.cost.v1',
  rate: 'agm.car-mover.rate.v1',
  emptyKilometres: 'agm.car-mover.empty-kilometres.v1',
  document: 'agm.car-mover.document.v1',
  profileBridge: 'agm.car-mover.profile-context-bridge.v1',
} as const;

type CoreDefinition = {
  resolverId: string;
  source: AgmLibrarySourceId;
  intent: string;
  label: string;
};

const CORE_DEFINITIONS: readonly CoreDefinition[] = [
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.transport, source: 'CAR_MOVER_TRANSPORTS', intent: 'TRANSPORT_HISTORY', label: 'transport history' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.quote, source: 'CAR_MOVER_OFFERS', intent: 'QUOTE_HISTORY', label: 'quote history' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.client, source: 'CAR_MOVER_CLIENTS', intent: 'CLIENT_LOOKUP', label: 'client references' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.vehicle, source: 'CAR_MOVER_VEHICLES', intent: 'VEHICLE_LOOKUP', label: 'vehicles' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.route, source: 'CAR_MOVER_TRIP_HISTORY', intent: 'ROUTE_HISTORY', label: 'route history' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.platform, source: 'CAR_MOVER_PLATFORMS', intent: 'PLATFORM_HISTORY', label: 'platform history' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.cost, source: 'CAR_MOVER_COSTS', intent: 'COST_HISTORY', label: 'cost history' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.rate, source: 'CAR_MOVER_RATES', intent: 'RATE_HISTORY', label: 'rate history' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.emptyKilometres, source: 'CAR_MOVER_EMPTY_KILOMETRES', intent: 'EMPTY_KILOMETRES_HISTORY', label: 'empty kilometres' },
  { resolverId: CAR_MOVER_LIBRARY_RESOLVERS.document, source: 'CAR_MOVER_DOCUMENTS', intent: 'DOCUMENT_LOOKUP', label: 'document references' },
];

export class CarMoverDatabaseLibraryResolver implements LibraryResolver {
  readonly descriptor;

  constructor(private readonly definition: CoreDefinition, private readonly repository: CarMoverLibraryRepositoryPort, private readonly now = () => new Date()) {
    this.descriptor = {
      resolverId: definition.resolverId,
      source: definition.source,
      owner: 'AGM_CAR_MOVER_DATABASE',
      supportedDomains: ['CAR_MOVER'] as const,
      sensitivity: 'OPERATIONAL' as const,
      authorizationAction: `library:read:${definition.source.toLowerCase()}`,
    };
  }

  match(request: LibraryRequest) {
    const sources = classifyCarMoverSources(request.query.text);
    const eligible = sources.includes(this.definition.source);
    return { eligible, confidence: eligible ? 0.94 : 0, intent: eligible ? this.definition.intent : 'NOT_CAR_MOVER_SOURCE', subject: extractSubject(request.query.text) };
  }

  async resolve(input: Parameters<LibraryResolver['resolve']>[0]): Promise<LibraryResolverResult> {
    const jobId = input.request.sourceInputs?.PREMIUM_CONTEXT && typeof input.request.sourceInputs.PREMIUM_CONTEXT === 'object'
      ? stringField(input.request.sourceInputs.PREMIUM_CONTEXT, 'jobId') : undefined;
    const records = await this.repository.search(this.definition.source, input.request.query.text, requestContext(input.request), jobId);
    const key = digest(`${this.definition.source}:${input.request.identity.tenantId}:${input.request.query.text}:${jobId ?? ''}`);
    const observedAt = records[0]?.observedAt ?? this.now().toISOString();
    const answerText = records.length ? composeAnswer(records, input.request.query.language, this.definition.label) : noDataText(input.request.query.language, this.definition.label);
    return {
      status: records.length ? 'FOUND' : 'NO_DATA',
      identity: { subjectType: this.definition.source, subjectId: records[0]?.id ?? null, displayName: input.match.subject ?? this.definition.label },
      query: { intent: this.definition.intent, normalizedText: normalize(input.request.query.text) },
      result: { summary: records.length ? answerText : `CAR_MOVER_${this.definition.intent}_NO_DATA`, recordCount: records.length },
      confidence: records.length ? Math.min(...records.map((record) => record.confidence)) : 1,
      ambiguity: { ambiguous: false, candidateIds: [] },
      provenance: {
        sourceRecordId: `car-mover-query:${key}`,
        owner: input.request.identity.tenantId,
        namespace: `agm-car-mover/${this.definition.source.toLowerCase()}`,
        evidenceRefs: records.map((record) => `${record.entityType}:${record.id}`),
      },
      freshness: freshness(observedAt, this.now()),
      minimalAuthorizedPayload: {
        answerText,
        records: records.map((record) => ({ id: record.id, entityType: record.entityType, title: record.title, summary: record.summary, observedAt: record.observedAt, payload: record.payload })),
        sources: records.map((record) => sourceReference(record, this.definition.source, input.request.query.language, this.now())),
      },
      deduplicationKey: records.length === 1 ? records[0]!.deduplicationKey : `car-mover-query:${this.definition.source}:${key}`,
    };
  }
}

export class ProfileContextBridgeResolver implements LibraryResolver {
  readonly descriptor = {
    resolverId: CAR_MOVER_LIBRARY_RESOLVERS.profileBridge,
    source: 'PROFILE_CONTACTS' as const,
    owner: 'AGM_PROFILE_USER_DATA',
    supportedDomains: ['PROFILE'] as const,
    sensitivity: 'PERSONAL' as const,
    authorizationAction: 'library:read:pre-resolved-profile-contacts',
  };

  match(request: LibraryRequest) {
    const eligible = request.query.intentHints?.includes('PROFILE_CONTACTS') ?? false;
    return { eligible, confidence: eligible ? 0.98 : 0, intent: eligible ? 'PROFILE_CONTACT_CONTEXT' : 'NOT_PROFILE_CONTEXT', subject: extractSubject(request.query.text) };
  }

  async resolve(input: Parameters<LibraryResolver['resolve']>[0]): Promise<LibraryResolverResult> {
    const upstream = validProfilePackage(input.request.sourceInputs?.PROFILE_CONTACTS);
    const context = upstream?.contexts.find((item) => item.contributingSources.includes('PROFILE_CONTACTS'));
    const clarification = upstream?.clarifications.find((item) => item.resolverId === 'agm.profile.personal-contacts.v1');
    const key = digest(`${input.request.identity.subjectId}:${input.request.query.text}`);
    if (clarification) return {
      status: 'AMBIGUOUS', identity: { subjectType: 'PROFILE_PERSON', subjectId: null, displayName: input.match.subject },
      query: { intent: 'PROFILE_CONTACT_CONTEXT', normalizedText: normalize(input.request.query.text) },
      result: { summary: 'PROFILE_CONTACT_CLARIFICATION_REQUIRED', recordCount: clarification.candidateIds.length }, confidence: 1,
      ambiguity: { ambiguous: true, candidateIds: clarification.candidateIds, clarificationPrompt: clarification.prompt },
      provenance: { sourceRecordId: `profile-context:${key}`, owner: input.request.identity.subjectId, namespace: 'AGM_SHARED_PROFILE/contacts', evidenceRefs: [upstream!.requestId] },
      freshness: { status: 'CURRENT', observedAt: new Date().toISOString(), expiresAt: null },
      minimalAuthorizedPayload: clarification.minimalAuthorizedPayload, deduplicationKey: `profile-contact:${key}`,
    };
    if (!context) return noProfileData(input.request, key);
    return {
      status: 'FOUND', identity: context.identity,
      query: { intent: 'PROFILE_CONTACT_CONTEXT', normalizedText: normalize(input.request.query.text) },
      result: { summary: context.summary, recordCount: 1 }, confidence: context.confidence,
      ambiguity: { ambiguous: false, candidateIds: [] },
      provenance: { sourceRecordId: context.contextId, owner: input.request.identity.subjectId, namespace: 'AGM_SHARED_PROFILE/contacts', evidenceRefs: [upstream!.requestId] },
      freshness: context.freshness,
      minimalAuthorizedPayload: context.minimalAuthorizedPayload,
      deduplicationKey: context.contextId,
    };
  }
}

export function createCarMoverDatabaseResolvers(repository: CarMoverLibraryRepositoryPort, now = () => new Date()) {
  return CORE_DEFINITIONS.map((definition) => new CarMoverDatabaseLibraryResolver(definition, repository, now));
}

export function planCarMoverDomains(text: string): { domains: AgmLibraryDomain[]; intentHints: string[] } {
  const value = normalize(text);
  const domains: AgmLibraryDomain[] = ['CAR_MOVER'];
  const intentHints: string[] = [];
  const historical = /\b(?:mai\s+(?:avut|transport\w*)|anterior\w*|istoric\w*|discut\w*|stabilit\w*|previous|history|discussed)\b/.test(value);
  const archive = /\b(?:mai avut|ultima data|anterior\w*|arhiv\w*|salvat\w*|aseman\w*|last time|previous|archive|saved|similar)\b/.test(value);
  const gmail = /\b(?:gmail|email|emailuri|emailurile|mail|mailuri|inbox|mesaj de la)\b/.test(value);
  const profile = /\b(?:contact\w*|telefon\w*|emailul|emailului|adresa de email|messenger|whatsapp)\b/.test(value)
    && /\b(?:client\w*|persoan\w*|sofer\w*|contact\w*)\b/.test(value);
  if (historical) intentHints.push('CONVERSATION_HISTORY');
  if (archive) intentHints.push('AGM_SHARED_ARCHIVE');
  if (gmail) intentHints.push('GMAIL');
  if (profile) intentHints.push('PROFILE_CONTACTS');
  if (historical || archive) domains.push('BASIC');
  if (gmail) domains.push('PREMIUM');
  if (profile) domains.push('PROFILE');
  return { domains: [...new Set(domains)], intentHints };
}

export function classifyCarMoverSources(text: string): AgmLibrarySourceId[] {
  const value = normalize(text);
  const sources = new Set<AgmLibrarySourceId>();
  if (/\b(?:transport\w*|curs\w*|job\w*|shipment\w*)\b/.test(value)) sources.add('CAR_MOVER_TRANSPORTS');
  if (/\b(?:ofert\w*|cerut\w*|quote\w*|bid\w*)\b/.test(value)) sources.add('CAR_MOVER_OFFERS');
  if (/\b(?:client\w*|partener\w*|counterpart\w*)\b/.test(value)) sources.add('CAR_MOVER_CLIENTS');
  if (/\b(?:masin\w*|vehicul\w*|vin|inmatricular\w*|car)\b/.test(value)) sources.add('CAR_MOVER_VEHICLES');
  if (/\b(?:rut\w*|trase\w*|pickup\w*|destinati\w*|route\w*)\b/.test(value)) sources.add('CAR_MOVER_TRIP_HISTORY');
  if (/\b(?:platform\w*|clicktrans|trans eu)\b/.test(value)) sources.add('CAR_MOVER_PLATFORMS');
  if (/\b(?:cost\w*|cheltu\w*|marj\w*|expense\w*)\b/.test(value)) sources.add('CAR_MOVER_COSTS');
  if (/\b(?:tarif\w*|pret\w*|incasar\w*|rate\w*|price\w*|revenue\w*)\b/.test(value)) sources.add('CAR_MOVER_RATES');
  if (/\b(?:km\s+go\w*|kilometr\w*\s+go\w*|deplas\w*\s+goal\w*|empty km|empty kilometres|deadhead)\b/.test(value)) sources.add('CAR_MOVER_EMPTY_KILOMETRES');
  if (/\b(?:document\w*|cmr|factur\w*|invoice\w*|evidence\w*)\b/.test(value)) sources.add('CAR_MOVER_DOCUMENTS');
  if (!sources.size) sources.add('CAR_MOVER_TRANSPORTS');
  return [...sources];
}

function validProfilePackage(value: unknown): ResolvedContextPackage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ResolvedContextPackage>;
  if (typeof candidate.contractVersion !== 'string' || !Array.isArray(candidate.contexts) || !Array.isArray(candidate.clarifications)) return null;
  const authorizedSource = candidate.contexts.some((context) => context.contributingSources.includes('PROFILE_CONTACTS'))
    || candidate.clarifications.some((item) => item.resolverId === 'agm.profile.personal-contacts.v1');
  return authorizedSource ? value as ResolvedContextPackage : null;
}

function noProfileData(request: LibraryRequest, key: string): LibraryResolverResult {
  const observedAt = new Date().toISOString();
  return {
    status: 'NO_DATA', identity: { subjectType: 'PROFILE_PERSON', subjectId: null },
    query: { intent: 'PROFILE_CONTACT_CONTEXT', normalizedText: normalize(request.query.text) },
    result: { summary: 'PROFILE_AUTHORIZED_CONTEXT_NO_DATA', recordCount: 0 }, confidence: 1,
    ambiguity: { ambiguous: false, candidateIds: [] },
    provenance: { sourceRecordId: `profile-context:${key}`, owner: request.identity.subjectId, namespace: 'AGM_SHARED_PROFILE/contacts', evidenceRefs: [] },
    freshness: { status: 'UNKNOWN', observedAt, expiresAt: null }, minimalAuthorizedPayload: {}, deduplicationKey: `profile-contact:${key}`,
  };
}

function composeAnswer(records: readonly CarMoverLibraryRecord[], language: string, label: string) {
  const details = records.slice(0, 3).map((record) => `${record.title}: ${record.summary}`).join(' ');
  if (language === 'ro') return `Am găsit ${records.length} rezultate relevante în ${label}: ${details}`;
  if (language === 'de') return `Ich habe ${records.length} relevante Ergebnisse in ${label} gefunden: ${details}`;
  return `I found ${records.length} relevant results in ${label}: ${details}`;
}

function noDataText(language: string, label: string) {
  if (language === 'ro') return `Am verificat ${label}, dar nu am găsit date relevante.`;
  if (language === 'de') return `Ich habe ${label} geprüft, aber keine relevanten Daten gefunden.`;
  return `I checked ${label} but found no relevant data.`;
}

function sourceReference(record: CarMoverLibraryRecord, source: AgmLibrarySourceId, language: string, now: Date): AssistantSourceReference {
  const state = freshness(record.observedAt, now);
  return {
    sourceId: `CAR-MOVER-${digest(`${source}:${record.id}`)}`, title: record.title, origin: 'AGM Car Mover',
    urlOrIdentifier: `agm:car-mover:${record.entityType.toLowerCase()}:${record.id}`, timestamp: record.observedAt,
    domain: [source], language, confidence: record.confidence, originType: 'AGM_INTERNAL', retrievalType: 'LIBRARY',
    freshness: { status: state.status, checkedAt: now.toISOString(), expiresAt: null, ttlSeconds: 0 },
    provenance: { canonicalPath: `AGM_CAR_MOVER/${record.entityType}/${record.id}`, sha256: digest(JSON.stringify(record.payload)), authorityType: 'TENANT_SCOPED_PREMIUM', reviewStatus: 'OPERATIONAL_RECORD' },
  };
}

function freshness(observedAt: string, now: Date) {
  const age = now.getTime() - Date.parse(observedAt);
  return { status: age <= 30 * 86_400_000 ? 'CURRENT' as const : 'STALE' as const, observedAt, expiresAt: null };
}

function requestContext(request: LibraryRequest): RequestContext {
  return { requestId: request.requestId, correlationId: request.correlationId, userId: request.identity.subjectId, companyId: request.identity.tenantId, roles: [...request.identity.roles] };
}

function stringField(value: object, field: string) {
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === 'string' ? candidate : undefined;
}

function extractSubject(value: string) {
  const match = /\b(?:despre|pentru|pe ruta|about|for|on route)\s+(.+?)(?:[?!.]|$)/i.exec(value);
  return match?.[1]?.trim().slice(0, 120);
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}
