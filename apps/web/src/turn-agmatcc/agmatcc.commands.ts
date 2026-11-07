import { foldText } from './agmatcc.ledger';
import { authenticatedApiFetch, resolveApiUrl } from '../authenticated-api';
import { turnAdminAuthenticatedFetch } from '../admin-auth';
import { fetchTurnOperationalTruth, type TurnOperationalTruth } from '../turn-operational-truth';
import { deriveTccAlerts, type TccBackendAlert } from './agmatcc.alerts';

export type AgmatccVoiceCommand =
  | { type: 'search'; query: string }
  | { type: 'play-last' }
  | { type: 'open-journal'; target: string }
  | { type: 'read-remote-journal' }
  | { type: 'list-incidents' }
  | { type: 'search-agmatcc-events'; query: string }
  | { type: 'read-tcc-alerts' }
  | { type: 'clarify'; question: string }
  | { type: 'none' };

const OPTIONAL_LEGACY_PREFIX = /^(?:(?:agma|agmatcc)\s+)?(?:comanda|comand)\s+/;

export type ServerSemanticResult = {
  hits: Array<{ eventType: string; score: number; matchedConcepts: string[]; source: string }>;
  coverage: { total: number; scanned: number; complete: boolean };
};

export type RemoteAgmatccEvent = {
  eventId: string;
  eventType: string;
  aggregateVersion: number;
  recordedAt: string;
  text: string;
  source: string;
};

export type IncidentJournalRecord = {
  id: string;
  status: string;
  severity: string;
  title: string;
  description?: string;
  createdAt: string;
  transportJobId?: string;
};

/**
 * Resolve only explicit read/search/play intents; unrecognized dictation remains inert.
 * The legacy "comandă" prefix stays accepted but is no longer required.
 */
export function parseAgmatccVoiceCommand(transcript: string): AgmatccVoiceCommand {
  const folded = foldText(transcript);
  const body = folded.replace(OPTIONAL_LEGACY_PREFIX, '').trim();
  if (!body) return { type: 'none' };

  let found: RegExpExecArray | null;
  if (/^(?:citeste|interogheaza|verifica)\s+jurnal(?:ul)?\s+(?:(?:de\s+pe)\s+)?server(?:ului)?$/.test(body)) return { type: 'read-remote-journal' };
  if (/^(?:citeste|interogheaza)\s+jurnal(?:ul)?\s*$/.test(body)) return { type: 'clarify', question: 'Care jurnal: jurnalul serverului AGMaTCC sau alt jurnal TURN?' };
  if (/^(?:arata|afiseaza|listeaza)\s+(?:ultimele\s+)?incidente(?:le)?(?:\s+(?:recente|active|deschise))?$/.test(body)) return { type: 'list-incidents' };
  if (/^(?:ce|care)\s+alerte\s+(?:avem|exista)\s+(?:in|pe)\s+turn$/.test(body)
    || /^(?:arata|afiseaza|listeaza)\s+alertele\s+(?:din\s+)?turn$/.test(body)) return { type: 'read-tcc-alerts' };
  if (/^(?:cauta|gaseste)\s+(?:evenimentele|evenimentele\s+din)\s+agmatcc$/.test(body)) return { type: 'search-agmatcc-events', query: 'AGMaTCC' };
  if (/^(?:cauta|gaseste)\s*$/.test(body)) return { type: 'clarify', question: 'Ce vrei să caut?' };
  if ((found = /^(?:cauta|cautare)\s+(.+)$/.exec(body))) return { type: 'search', query: found[1] };
  if (/^(?:reda|citeste)\s+(?:ultima|ultimul)/.test(body)) return { type: 'play-last' };
  if ((found = /^deschide\s+(?:jurnal(?:ul)?\s+)?(.+)$/.exec(body))) return { type: 'open-journal', target: found[1] };
  return { type: 'none' };
}

export async function readAgmatccJournalStream(
  streamId: string,
  fetcher: typeof fetch = turnAdminAuthenticatedFetch as typeof fetch,
) {
  const path = `/operational-events/${encodeURIComponent(streamId)}?afterVersion=-1`;
  const response = await fetcher(path, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AGMATCC_JOURNAL_HTTP_${response.status}`);
  const payload = await response.json() as { data?: { streamId?: string; serverVersion?: number; events?: unknown[] } };
  if (!payload.data || !Number.isInteger(payload.data.serverVersion) || !Array.isArray(payload.data.events)) {
    throw new Error('AGMATCC_JOURNAL_INVALID_PAYLOAD');
  }
  const events = payload.data.events.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error('AGMATCC_JOURNAL_INVALID_EVENT');
    const event = value as Record<string, unknown>;
    const body = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {};
    const eventId = typeof event.eventId === 'string' ? event.eventId : '';
    const eventType = typeof event.eventType === 'string' ? event.eventType : '';
    const aggregateVersion = Number.isInteger(event.aggregateVersion) ? Number(event.aggregateVersion) : index;
    const recordedAt = typeof event.recordedAt === 'string' ? event.recordedAt : typeof event.occurredAt === 'string' ? event.occurredAt : '';
    if (!eventId || !eventType || !recordedAt) throw new Error('AGMATCC_JOURNAL_INVALID_EVENT');
    return {
      eventId,
      eventType,
      aggregateVersion,
      recordedAt,
      text: typeof body.text === 'string' ? body.text : '',
      source: `operational-event:${payload.data!.streamId ?? streamId}@${aggregateVersion}`,
    };
  });
  return {
    streamId: payload.data.streamId ?? streamId,
    serverVersion: Number(payload.data.serverVersion),
    count: events.length,
    events,
    source: 'GET /operational-events/:streamId?afterVersion=-1',
    scope: 'AGMaTCC device stream; authorized read',
  };
}

export async function readLatestIncidents(fetcher: typeof fetch = authenticatedApiFetch as typeof fetch) {
  const response = await fetcher(resolveApiUrl('/incidents'), { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`INCIDENT_JOURNAL_HTTP_${response.status}`);
  const payload = await response.json() as { data?: unknown } | unknown[];
  const records = Array.isArray(payload) ? payload : Array.isArray((payload as { data?: unknown })?.data) ? (payload as { data: unknown[] }).data : null;
  if (!records) throw new Error('INCIDENT_JOURNAL_INVALID_PAYLOAD');
  const incidents = records.map((value) => {
    if (!value || typeof value !== 'object') throw new Error('INCIDENT_JOURNAL_INVALID_RECORD');
    const incident = value as Record<string, unknown>;
    if (typeof incident.id !== 'string' || typeof incident.status !== 'string' || typeof incident.severity !== 'string'
      || typeof incident.title !== 'string' || typeof incident.createdAt !== 'string') throw new Error('INCIDENT_JOURNAL_INVALID_RECORD');
    return {
      id: incident.id,
      status: incident.status,
      severity: incident.severity,
      title: incident.title,
      description: typeof incident.description === 'string' ? incident.description : undefined,
      createdAt: incident.createdAt,
      transportJobId: typeof incident.transportJobId === 'string' ? incident.transportJobId : undefined,
    } satisfies IncidentJournalRecord;
  });
  return {
    incidents,
    count: incidents.length,
    source: 'API-006 GET /incidents',
    scope: 'authenticated user company scope',
    coverage: 'COMPLETE' as const,
    checkedAt: new Date().toISOString(),
  };
}

export async function readTccAlertSnapshot(loadTruth: () => Promise<TurnOperationalTruth> = () => fetchTurnOperationalTruth()): Promise<{
  alerts: TccBackendAlert[];
  source: string;
  status: TurnOperationalTruth['overallStatus'];
  freshness: TurnOperationalTruth['freshness'];
  observedAt: string;
}> {
  const truth = await loadTruth();
  return {
    alerts: deriveTccAlerts(truth),
    source: 'GET /operations/turn/operational-truth',
    status: truth.overallStatus,
    freshness: truth.freshness,
    observedAt: truth.observedAt ?? truth.generatedAt,
  };
}

export async function searchServerSemantic(query: string, fetcher: typeof turnAdminAuthenticatedFetch = turnAdminAuthenticatedFetch): Promise<ServerSemanticResult> {
  const response = await fetcher(`/operational-events/search/semantic?q=${encodeURIComponent(query.trim())}&limit=20`, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AGMATCC_SEMANTIC_HTTP_${response.status}`);
  const payload = await response.json() as { data?: ServerSemanticResult };
  if (!payload.data || !payload.data.coverage || !Array.isArray(payload.data.hits)) throw new Error('AGMATCC_SEMANTIC_EMPTY_PAYLOAD');
  return payload.data;
}
