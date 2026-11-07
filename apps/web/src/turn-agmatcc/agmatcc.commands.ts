import { foldText } from './agmatcc.ledger';
import { authenticatedApiFetch, resolveApiUrl } from '../authenticated-api';
import { turnAdminAuthenticatedFetch } from '../admin-auth';
import { fetchTurnOperationalTruth, type TurnOperationalTruth } from '../turn-operational-truth';
import { deriveTccAlerts, type TccBackendAlert } from './agmatcc.alerts';

export type AgmatccVoiceCommand =
  | { type: 'search'; query: string }
  | { type: 'play-last' }
  | { type: 'read-last-event' }
  | { type: 'read-event-detail'; field: 'id' | 'hash' | 'endpoint' | 'audit'; eventId?: string }
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
  ledgerHash?: string;
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
  const requestedId = /(?:id(?:-ul)?\s+evenimentului|event\s+id)\s*[:=]?\s+([A-Za-z0-9._:-]+)/i.exec(transcript)?.[1];
  if (/\b(?:id ul|identificatorul)\s+evenimentului\b/.test(body)
    || /^(?:care este|care e)\s+(?:id ul|identificatorul)\s+evenimentului$/.test(body)) {
    return { type: 'read-event-detail', field: 'id', ...(requestedId ? { eventId: requestedId } : {}) };
  }
  if (/\b(?:hash ul|amprenta)\s+evenimentului\b/.test(body)) return { type: 'read-event-detail', field: 'hash', ...(requestedId ? { eventId: requestedId } : {}) };
  if (/\b(?:endpointul|adresa endpointului)\b/.test(body)) return { type: 'read-event-detail', field: 'endpoint', ...(requestedId ? { eventId: requestedId } : {}) };
  if (/\bdetalii(?:le)? de audit\b/.test(body)) return { type: 'read-event-detail', field: 'audit', ...(requestedId ? { eventId: requestedId } : {}) };
  if (/^(?:ce s a intamplat|ce s a petrecut)\s+(?:ultima data|cel mai recent)$/.test(body)
    || /^(?:ce a fost|care a fost)\s+ultimul eveniment$/.test(body)) return { type: 'read-last-event' };
  if (/^(?:citeste|interogheaza|verifica)\s+jurnal(?:ul)?\s+(?:(?:de\s+pe)\s+)?server(?:ului)?$/.test(body)) return { type: 'read-remote-journal' };
  if (/^(?:citeste|interogheaza)\s+jurnal(?:ul)?\s*$/.test(body)) return { type: 'clarify', question: 'Care jurnal: jurnalul serverului AGMaTCC sau alt jurnal TURN?' };
  if (/^(?:avem|exista)\s+incidente$/.test(body)) return { type: 'list-incidents' };
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

export type AgmatccEventDisposition = 'executed' | 'failed' | 'warning' | 'blocked' | 'unknown';

const eventTypeLabels: Record<string, string> = {
  'agmatcc.note': 'notă',
  'agmatcc.voice-transcript-confirmed': 'transcriere vocală confirmată',
  'agmatcc.playback': 'redare vocală',
  'agmatcc.search': 'căutare',
  'agmatcc.journal-link-opened': 'deschidere jurnal',
};

function eventLabel(eventType: string): string {
  return eventTypeLabels[eventType] ?? 'eveniment neclasificat';
}

function countedEventType(label: string, count: number): string {
  const pluralLabels: Record<string, string> = {
    'notă': 'note',
    'transcriere vocală confirmată': 'transcrieri vocale confirmate',
    'redare vocală': 'redări vocale',
    'căutare': 'căutări',
    'deschidere jurnal': 'deschideri de jurnal',
    'eveniment neclasificat': 'evenimente neclasificate',
  };
  return `${count} ${count === 1 ? label : pluralLabels[label] ?? label}`;
}

function redactTechnicalText(value: string): string {
  return value
    .replace(/\bhttps?:\/\/\S+|(?:\/[A-Za-z0-9._:-]+){2,}(?:\?[^\s·]*)?/gi, '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/\b[0-9a-f]{64}\b/gi, '')
    .replace(/\b(?:event|evt|incident|job)[-_][A-Za-z0-9_-]+\b/gi, '')
    .replace(/\b(?:sha-?256|ledgerHash|hash)\s*[:=]?\s*[0-9a-f]{16,}\b/gi, '')
    .replace(/\b(?:eventId|event id|incident id|aggregateVersion|serverVersion|source|score|endpoint|status|freshness)\s*[:=]?\s*[^·,.;\s]+/gi, '')
    .replace(/\bagmatcc\.[a-z0-9._-]+\b/gi, '')
    .replace(/\b(?:version|versiunea)\s+\d+\.\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b(?:AGMaTCC|AGM)\s+v?\d+\.\d+(?:\.\d+)?\b/gi, '')
    .replace(/\s*[·|]\s*(?:source|ref|serverVersion|aggregateVersion)\b[^.]*\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function eventAuditTrace(event: RemoteAgmatccEvent): string {
  return event.text.split(/\bRESPONSE:\s*/i, 1)[0] ?? '';
}

export function getAgmatccEventDisposition(event: RemoteAgmatccEvent): AgmatccEventDisposition {
  const trace = eventAuditTrace(event);
  if (/\bBLOCKED\s+[—-]/i.test(trace)) return 'blocked';
  if (/\bFAILED\s+[—-]/i.test(trace) || /^PLAYBACK FAILED\b/i.test(event.text)) return 'failed';
  if (/\bWARNING\s+[—-]/i.test(trace)) return 'warning';
  if (/\bEXECUTED\s+[—-]/i.test(trace)) return 'executed';
  if (/^PLAYBACK COMPLETED\b/i.test(event.text)) return 'executed';
  if (/\.(?:warning|blocked|failed)$/.test(event.eventType)) {
    return event.eventType.endsWith('.warning') ? 'warning' : event.eventType.endsWith('.blocked') ? 'blocked' : 'failed';
  }
  return 'unknown';
}

function dispositionLabel(disposition: AgmatccEventDisposition): string {
  return {
    executed: 'încheiată',
    failed: 'eșuată',
    warning: 'avertisment înregistrat',
    blocked: 'blocată',
    unknown: 'fără stare de execuție consemnată',
  }[disposition];
}

function eventMeaning(event: RemoteAgmatccEvent, disposition: AgmatccEventDisposition): string {
  if (event.eventType === 'agmatcc.voice-transcript-confirmed') return 'Transcrierea a fost confirmată.';
  if (event.eventType === 'agmatcc.playback') {
    if (disposition === 'failed') return 'Redarea vocală a eșuat.';
    if (disposition === 'executed') return 'Redarea vocală s-a încheiat.';
    return 'Rezultatul redării nu este consemnat.';
  }
  if (event.eventType === 'agmatcc.journal-link-opened') return 'A fost deschis un jurnal TURN.';
  if (event.eventType === 'agmatcc.note') {
    const response = /\bRESPONSE:\s*([\s\S]*?)(?:\s+·\s+PLAYBACK(?:\s+UNAVAILABLE|\s+FAILED)?\b|$)/i.exec(event.text)?.[1];
    if (response) {
      const safeResponse = redactTechnicalText(response);
      return safeResponse ? `Răspuns înregistrat: ${safeResponse}` : 'Răspunsul conține numai detalii tehnice.';
    }
    if (/^PLAYBACK FAILED\b/i.test(event.text)) return 'Redarea vocală a eșuat.';
    if (/^COMMAND_RESULT\b/i.test(event.text)) return 'A fost înregistrat un rezultat de comandă.';
    const safeText = redactTechnicalText(event.text);
    return safeText ? `Notă: ${safeText}` : 'A fost înregistrată o notă.';
  }
  if (event.eventType === 'agmatcc.search') return 'A fost efectuată o căutare.';
  return 'Tipul evenimentului nu este clasificat.';
}

export function describeAgmatccEvent(event: RemoteAgmatccEvent): string {
  const disposition = getAgmatccEventDisposition(event);
  return `${eventLabel(event.eventType)}: ${dispositionLabel(disposition)}. ${eventMeaning(event, disposition)}`;
}

export function summarizeLocalAgmatccEntry(entry: { kind: string; text: string }): string {
  return describeAgmatccEvent({
    eventId: '',
    eventType: `agmatcc.${entry.kind}`,
    aggregateVersion: 0,
    recordedAt: '',
    text: entry.text,
    source: '',
  });
}

export function summarizeAgmatccJournal(journal: { count: number; events: RemoteAgmatccEvent[] }): string {
  if (!journal.events.length) return 'Jurnalul serverului nu conține evenimente în fluxul AGMaTCC al acestui dispozitiv.';

  const typeCounts = new Map<string, number>();
  const dispositionCounts: Record<AgmatccEventDisposition, number> = {
    executed: 0, failed: 0, warning: 0, blocked: 0, unknown: 0,
  };
  journal.events.forEach((event) => {
    const label = eventLabel(event.eventType);
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
    dispositionCounts[getAgmatccEventDisposition(event)] += 1;
  });
  const types = [...typeCounts].map(([label, count]) => countedEventType(label, count)).join(', ');
  const eventWord = journal.count === 1 ? 'eveniment' : 'evenimente';
  const parts = [`Jurnalul serverului conține ${journal.count} ${eventWord}: ${types}.`];
  const issues = [
    dispositionCounts.failed ? `${dispositionCounts.failed} ${dispositionCounts.failed === 1 ? 'eșuat' : 'eșuate'}` : '',
    dispositionCounts.blocked ? `${dispositionCounts.blocked} ${dispositionCounts.blocked === 1 ? 'blocat' : 'blocate'}` : '',
    dispositionCounts.warning ? `${dispositionCounts.warning} ${dispositionCounts.warning === 1 ? 'avertisment' : 'avertismente'}` : '',
  ].filter(Boolean);
  if (issues.length) parts.push(`Probleme înregistrate: ${issues.join(', ')}.`);
  else parts.push('Nu sunt eșecuri, avertismente sau blocaje marcate explicit.');
  if (dispositionCounts.unknown) {
    const unknownWord = dispositionCounts.unknown === 1 ? 'eveniment' : 'evenimente';
    parts.push(`Starea execuției nu este consemnată pentru ${dispositionCounts.unknown} ${unknownWord}.`);
  }
  const recent = [...journal.events].sort((a, b) => a.aggregateVersion - b.aggregateVersion).slice(-3).reverse();
  parts.push(`Ultimele evenimente: ${recent.map(describeAgmatccEvent).join(' ')}`);
  return parts.join(' ');
}

export function summarizeIncidentJournal(journal: { incidents: IncidentJournalRecord[]; count: number; coverage: string }): string {
  if (!journal.count) {
    return journal.coverage === 'COMPLETE'
      ? 'Nu există incidente înregistrate pentru compania autentificată; verificarea a avut acoperire completă.'
      : 'Nu au fost găsite incidente, dar acoperirea verificării este incompletă.';
  }
  const resolvedStatuses = new Set(['resolved', 'closed', 'archived', 'validated', 'complete', 'completed']);
  const openStatuses = new Set(['new', 'open', 'active', 'investigating', 'analysis', 'remediation', 'reopened', 'in_progress', 'in-progress', 'pending']);
  let open = 0;
  let resolved = 0;
  let unknown = 0;
  for (const incident of journal.incidents) {
    const status = foldText(incident.status).replace(/\s+/g, '_');
    if (openStatuses.has(status)) open += 1;
    else if (resolvedStatuses.has(status)) resolved += 1;
    else unknown += 1;
  }
  const parts = [`Jurnalul conține ${journal.count} ${journal.count === 1 ? 'incident' : 'incidente'}.`];
  if (open) parts.push(open === 1 ? 'Unul este deschis.' : `${open} sunt deschise.`);
  if (resolved) parts.push(resolved === 1 ? 'Unul este închis sau rezolvat.' : `${resolved} sunt închise sau rezolvate.`);
  if (unknown) parts.push(unknown === 1 ? 'Starea unui incident nu este clasificată.' : `Starea a ${unknown} incidente nu este clasificată.`);
  const notable = [...journal.incidents]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3).map((incident) => {
    const severity = new Map([['critical', 'critică'], ['high', 'ridicată'], ['major', 'majoră'], ['medium', 'medie'], ['low', 'scăzută']])
      .get(foldText(incident.severity)) ?? 'necunoscută';
    const title = redactTechnicalText(incident.title);
    return `${severity}${title ? `: ${title}` : ''}`;
  });
  parts.push(`Incidente recente: ${notable.join('; ')}.`);
  return parts.join(' ');
}

export function summarizeTccAlerts(snapshot: {
  alerts: TccBackendAlert[];
  status: string;
  freshness: string;
}): string {
  if (!snapshot.alerts.length) {
    return snapshot.status === 'PASS' && snapshot.freshness === 'LIVE'
      ? 'Nu sunt alerte în sursa operațională curentă; starea raportată este normală și datele sunt actuale.'
      : 'Snapshotul nu conține alerte, dar starea curentă nu poate fi confirmată.';
  }
  const warnings = snapshot.alerts.filter((alert) => alert.alertClass === 'WARNING').length;
  const blocks = snapshot.alerts.filter((alert) => alert.alertClass === 'JUSTIFIED_BLOCK').length;
  const events = snapshot.alerts.filter((alert) => alert.alertClass === 'OPERATIONAL_EVENT').length;
  const notes = snapshot.alerts
    .filter((alert) => alert.alertClass !== 'OPERATIONAL_EVENT')
    .slice(0, 3)
    .map((alert) => {
      if (alert.alertClass === 'JUSTIFIED_BLOCK') return 'un blocaj preventiv este activ';
      if (/acces/i.test(alert.message)) return 'dovada de acces nu este curentă';
      if (/telemetrie/i.test(alert.message)) return 'telemetria nu este live';
      const falseGreen = /(\d+)\s+indicatori fals-verzi detectați/i.exec(alert.message)?.[1];
      if (falseGreen) return `au fost detectați ${falseGreen} indicatori fals-verzi`;
      if (/guardian/i.test(alert.message)) return 'starea controlului Guardian necesită atenție';
      const state = /Stare operațională ([^:]+):\s*(.*)/i.exec(alert.message);
      if (state) {
        const stateLabel = new Map([['PASS', 'normală'], ['DEGRADED', 'degradată'], ['FAIL', 'eșuată'], ['UNKNOWN', 'necunoscută']])
          .get(state[1].toLocaleUpperCase()) ?? 'nespecificată';
        const reason = redactTechnicalText(state[2]);
        return `starea operațională este ${stateLabel}${reason ? `: ${reason}` : ''}`;
      }
      return 'starea operațională necesită atenție';
    });
  const parts = ['Snapshotul operațional a fost citit.'];
  if (warnings) parts.push(`${warnings} ${warnings === 1 ? 'avertisment' : 'avertismente'}.`);
  if (blocks) parts.push(`${blocks} ${blocks === 1 ? 'blocaj justificat' : 'blocaje justificate'}.`);
  if (events) parts.push(`${events} ${events === 1 ? 'eveniment operațional' : 'evenimente operaționale'}.`);
  if (notes.length) parts.push(`Observații: ${[...new Set(notes)].join('; ')}.`);
  return parts.join(' ');
}

export function summarizeSemanticSearch(result: {
  server: ServerSemanticResult;
  localResults: unknown[];
}): string {
  const { server, localResults } = result;
  const byType = new Map<string, number>();
  server.hits.forEach((hit) => {
    const label = eventLabel(hit.eventType);
    byType.set(label, (byType.get(label) ?? 0) + 1);
  });
  const matches = [...byType].map(([label, count]) => countedEventType(label, count)).join(', ');
  if (!server.hits.length && !localResults.length) {
    return server.coverage.complete
      ? 'Nu au fost găsite evenimente potrivite în jurnalul serverului sau în istoricul local.'
      : 'Nu au fost găsite potriviri, dar jurnalul serverului a fost verificat doar parțial; absența nu este confirmată.';
  }
  const hitWord = server.hits.length === 1 ? 'eveniment relevant' : 'evenimente relevante';
  const parts = [`Am găsit ${server.hits.length} ${hitWord} în jurnalul serverului${matches ? `: ${matches}` : ''}.`];
  if (localResults.length) parts.push(localResults.length === 1 ? 'O potrivire suplimentară în istoricul local.' : `${localResults.length} potriviri suplimentare în istoricul local.`);
  if (!server.coverage.complete) parts.push('Căutarea serverului a acoperit doar o parte din jurnal.');
  return parts.join(' ');
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
      ...(typeof body.ledgerHash === 'string' ? { ledgerHash: body.ledgerHash } : {}),
    };
  });
  return {
    streamId: payload.data.streamId ?? streamId,
    serverVersion: Number(payload.data.serverVersion),
    endpoint: resolveApiUrl(path),
    requestPath: path,
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
