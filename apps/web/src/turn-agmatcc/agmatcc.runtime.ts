import { ADMIN_SESSION_KEY, turnAdminAuthenticatedFetch } from '../admin-auth';
import { bindAcpm } from './acpm.performance';
import { beginTurnModuleRead, updateTurnModuleReadState } from '../turn-command-navigation';
import './agmatcc.css';
import {
  parseAgmatccVoiceCommand,
  readAgmatccJournalStream,
  readLatestIncidents,
  readTccAlertSnapshot,
  readGovernanceModule, governanceReadFailure, summarizeGovernanceRead,
  describeAgmatccEvent,
  searchServerSemantic,
  summarizeAgmatccJournal,
  summarizeIncidentJournal,
  summarizeLocalAgmatccEntry,
  summarizeSemanticSearch,
  summarizeTccAlerts,
  type IncidentJournalRecord,
} from './agmatcc.commands';
import { semanticSearchAgmatccLedger } from './agmatcc.semantic';
import { deriveTccAlerts } from './agmatcc.alerts';
import { fetchTurnOperationalTruth } from '../turn-operational-truth';
import {
  foldText, AGMATCC_LEDGER_KEY, AGMATCC_STREAM_KEY, appendAgmatccEntry,   randomUuid, searchAgmatccLedger,
  toOperationalSyncItems, verifyAgmatccLedger, type AgmatccEntry, type AgmatccEntryKind, type AgmatccProvenance,
} from './agmatcc.ledger';

import { requireLunaConfiguration } from './luna-control';
import { readRecognitionTranscript, waitForSpeechVoice, speechRecognitionFailure } from './agmatcc.speech';
import { AgmatccConversationContext, conversationDisplayText, runAgmatccAiConversation } from './agmatcc.ai-conversation';

const SYNCED_KEY = 'agm.turn.agmatcc.synced-count.v1';
const ACTOR_ID = 'turn-admin-session';

type RecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; onstart: (() => void) | null; start(): void; stop(): void };

function readJson<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function stream() {
  const existing = readJson<{ streamId: string; deviceId: string } | null>(AGMATCC_STREAM_KEY, null);
  if (existing) return existing;
  const created = { streamId: randomUuid(), deviceId: randomUuid() };
  window.localStorage.setItem(AGMATCC_STREAM_KEY, JSON.stringify(created));
  return created;
}

export async function syncAgmatccLedger(fetcher: typeof fetch = turnAdminAuthenticatedFetch as typeof fetch) {
  const ledger = readJson<AgmatccEntry[]>(AGMATCC_LEDGER_KEY, []);
  const synced = Number(readJson<number>(SYNCED_KEY, 0));
  if (synced >= ledger.length) return { acknowledged: 0, pending: 0 };
  const items = toOperationalSyncItems(ledger, stream(), synced);
  const response = await fetcher('/operational-events/sync', {
    method: 'POST', cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: items }),
  });
  if (!response.ok) throw new Error(`AGMATCC_SYNC_HTTP_${response.status}`);
  const payload = await response.json() as { data?: { results?: Array<{ status: string }> } };
  const results = payload.data?.results ?? [];
  const accepted = results.findIndex((r) => r.status === 'conflict');
  const count = accepted === -1 ? results.length : accepted;
  window.localStorage.setItem(SYNCED_KEY, JSON.stringify(synced + count));
  return { acknowledged: count, pending: items.length - count };
}

export async function readRemoteAgmatccJournal(fetcher: typeof fetch = turnAdminAuthenticatedFetch as typeof fetch) {
  return readAgmatccJournalStream(stream().streamId, fetcher);
}

export function bindAgmatcc(language = 'ro-RO') {
  const root = document.querySelector<HTMLElement>('.turn-agmatcc-page');
  if (!root || root.dataset.agmatccBound) return;
  root.dataset.agmatccBound = '1';
  bindAcpm(root);
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const draft = $<HTMLTextAreaElement>('[data-agmatcc-draft]');
  const status = $('[data-agmatcc-status]');
  const aiQuestion = $<HTMLTextAreaElement>('[data-agmatcc-ai-question]');
  const aiSend = $<HTMLButtonElement>('[data-agmatcc-ai-send]');
  const aiAnswer = $('[data-agmatcc-ai-answer]');
  const aiEvidence = $('[data-agmatcc-ai-evidence]');
  const history = $('[data-agmatcc-history]');
  const results = $('[data-agmatcc-results]');
  const integrity = $('[data-agmatcc-integrity]');
  const syncLabel = $('[data-agmatcc-sync]');
  const auditTrace = $('[data-agmatcc-audit]');
  const auditPanel = $('.agmatcc-audit-panel') as HTMLDetailsElement;
  const resultsDetails = $('.agmatcc-evidence-details') as HTMLDetailsElement;
  const captureButton = $<HTMLButtonElement>('[data-agmatcc-capture]');
  const stopButton = $<HTMLButtonElement>('[data-agmatcc-stop]');
  let ledger = readJson<AgmatccEntry[]>(AGMATCC_LEDGER_KEY, []);
  let provenance: AgmatccProvenance = 'typed';
  let recognition: RecognitionLike | null = null;
  const stage = $('.agmatcc-stage');
  const questions = $('[data-agmatcc-questions]');
  const alerts = $('[data-agmatcc-alerts]');
  const setState = (state: 'idle' | 'listening' | 'speaking' | 'searching') => { stage.dataset.agmatccState = state; };
  let activeCommandTrace: string[] | null = null;
  const commandStage = (name: string, detail: string) => {
    if (!activeCommandTrace) activeCommandTrace = [];
    const trace = `${name} — ${detail}`;
    activeCommandTrace.push(trace);
    const item = document.createElement('li');
    item.textContent = trace;
    auditTrace.append(item);
    status.dataset.commandStage = name.toLocaleLowerCase().replaceAll('_', '-');
  };
  const showOperationRows = (mode: string, lines: string[]) => {
    results.innerHTML = '';
    lines.forEach((text) => {
      const item = document.createElement('li');
      item.dataset.agmatccMode = mode;
      item.textContent = text;
      results.append(item);
    });
  };
  const alert = (source: string, message: string) => {
    const li = document.createElement('li');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = source.includes('authorization')
      ? 'O comandă a fost blocată de autorizare.'
      : source.includes('execution') || source.includes('read')
        ? 'O citire sau o comandă nu a putut fi finalizată.'
        : 'A apărut o problemă tehnică.';
    const evidence = document.createElement('p');
    evidence.textContent = `[LOCAL · necertificat · ${source}] ${new Date().toISOString()} · ${message}`;
    details.append(summary, evidence);
    li.append(details);
    li.dataset.agmatccAlertOrigin = 'local';
    alerts.prepend(li);
    while (alerts.children.length > 20) alerts.lastElementChild?.remove();
  };
  let lastAiAnswer = '';
  let playbackGeneration = 0;
  const context = new AgmatccConversationContext();
  // Refresh rotates access tokens inside a family; logout/unlock changes the family.
  const readSessionIdentity = () => {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    try {
      const token = JSON.parse(raw ?? '{}').accessToken as string;
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.familyId === 'string' ? payload.familyId : raw;
    } catch { return raw; }
  };
  let sessionIdentity = readSessionIdentity();
  const sameSession = () => readSessionIdentity() === sessionIdentity;
  const conversationButton = $<HTMLButtonElement>('[data-agmatcc-conversation]');
  let conversationEnabled = false;
  let resumeRequested = false;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  const setConversation = (enabled: boolean) => {
    conversationEnabled = enabled;
    conversationButton.setAttribute('aria-pressed', String(enabled));
    conversationButton.textContent = enabled ? 'Oprește conversația' : 'Pornește conversația';
    if (!enabled) { resumeRequested = false; clearTimeout(resumeTimer); }
  };
  const resumeListening = () => {
    if (!resumeRequested || !conversationEnabled || aiSend.disabled) return;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (!root.isConnected || document.hidden || !sameSession()) { setConversation(false); context.clear(); return; }
      if (!conversationEnabled || aiSend.disabled || recognition) return;
      resumeRequested = false;
      startCapture();
    }, 350);
  };
  const askAi = async (question: string, speak = false, origin: 'voice' | 'typed' = 'typed') => {
    if (aiSend.disabled) return;
    if (!sameSession()) { context.clear(); sessionIdentity = readSessionIdentity(); }
    const requestSessionIdentity = sessionIdentity;
    const isRequestSessionCurrent = () => readSessionIdentity() === requestSessionIdentity;
    const generation = ++playbackGeneration;
    clearTimeout(captureTimer); clearTimeout(resumeTimer); resumeRequested = false;
    const previousCapture = recognition; recognition = null; previousCapture?.stop(); captureButton.disabled = false;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (question.length < 2) { setConversation(false); setState('idle'); aiAnswer.textContent = 'Scrie o întrebare mai clară.'; return; }
    aiSend.disabled = true;
    setState('searching');
    aiAnswer.textContent = 'Copilotul consultă numai sursele read-only autorizate…';
    aiEvidence.replaceChildren();
    try {
      await requireLunaConfiguration(turnAdminAuthenticatedFetch);
      if (generation !== playbackGeneration || !isRequestSessionCurrent() || !root.isConnected) return;
      const conversation = await runAgmatccAiConversation({ question, origin, requestId: randomUuid(),
        history: context.snapshot(),
        isCancelled: () => generation !== playbackGeneration || !isRequestSessionCurrent() || !root.isConnected,
        isSessionCurrent: isRequestSessionCurrent,
        fetcher: turnAdminAuthenticatedFetch,
        append: (text, provenance) => append('note', text, provenance, true),
      });
      const { result, executedModel, journalStatus } = conversation;
      if (generation !== playbackGeneration || !isRequestSessionCurrent() || !root.isConnected) return;
      if (result.status !== 'FAIL' && result.status !== 'BLOCKED' && journalStatus === 'SYNCED') context.remember(question, result.answer);
      lastAiAnswer = result.answer;
      status.textContent = result.answer;
      aiAnswer.textContent = result.answer;
      const trace = document.createElement('li');
      trace.textContent = `${result.status} | EXECUTED ${executedModel} | CONFIGURED ${result.model} | ${result.provider} | JOURNAL ${journalStatus}`;
      auditTrace.append(trace);
      for (const ref of result.evidenceRefs ?? []) { const item = document.createElement('li'); item.textContent = ref; aiEvidence.append(item); }
      if (result.status === 'FAIL' || result.status === 'BLOCKED' || journalStatus !== 'SYNCED') setConversation(false);
      if (speak && generation === playbackGeneration) {
        if (!await speakText(result.answer, `AI execution ${result.executionId}`)) { setConversation(false); setState('idle'); }
      } else setState('idle');
    } catch (error) {
      if (generation !== playbackGeneration || !isRequestSessionCurrent() || !root.isConnected) return;
      setConversation(false);
      setState('idle');
      aiAnswer.textContent = `Copilot AI indisponibil; parserul clasic rămâne disponibil. ${error instanceof Error ? error.message : 'Eroare necunoscută'}`;
      status.textContent = aiAnswer.textContent;
    } finally { aiSend.disabled = false; resumeListening(); }
  };
  aiSend.addEventListener('click', () => { void askAi(aiQuestion.value.trim(), true); });
  const refreshBackendAlerts = () => fetchTurnOperationalTruth().then((truth) => {
    alerts.querySelectorAll('[data-agmatcc-alert-origin="backend"]').forEach((node) => node.remove());
    deriveTccAlerts(truth).reverse().forEach((item) => {
      const li = document.createElement('li');
      li.dataset.agmatccAlertOrigin = 'backend';
      li.dataset.agmatccAlertClass = item.alertClass;
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = item.alertClass === 'WARNING'
        ? 'Avertisment operațional.'
        : item.alertClass === 'JUSTIFIED_BLOCK'
          ? 'Blocaj preventiv.'
          : 'Eveniment operațional.';
      const evidence = document.createElement('p');
      evidence.textContent = `[${item.alertClass} · ${item.source}] ${item.observedAt ?? ''} · ${item.message}${item.ref ? ` · ref ${item.ref}` : ''}`;
      details.append(summary, evidence);
      li.append(details);
      alerts.prepend(li);
    });
  }, (error: Error) => alert('operational-truth/read', error.message));

  let remoteCount: number | null = null;
  const journalConnection = root.querySelector<HTMLElement>('[data-agmatcc-journal-connection]');
  const refreshRemoteCount = () => readRemoteAgmatccJournal().then((journal) => {
    remoteCount = journal.count;
    if (journalConnection) { journalConnection.textContent = `conectat · ${journal.count} evenimente în fluxul acestui dispozitiv`; journalConnection.dataset.connectionStatus = 'CONNECTED_READ_ONLY'; }
  }, (error: Error) => {
    remoteCount = -1;
    if (journalConnection) { journalConnection.textContent = 'conexiune neconfirmată · verifică sesiunea TURN'; journalConnection.dataset.connectionStatus = 'UNAVAILABLE'; }
    alert('operational-events/read', error.message);
  });
  const render = async () => {
    const conversation = ledger.filter((entry) => entry.provenance !== 'system' || entry.kind === 'note' || entry.kind === 'playback');
    history.innerHTML = conversation.slice().reverse().map((entry) =>
      '<li><div></div></li>').join('');
    [...history.children].forEach((li, i) => {
      const entry = conversation[conversation.length - 1 - i];
      li.querySelector('div')!.textContent = conversationDisplayText(entry.text)
        ?? (entry.provenance === 'system' ? summarizeLocalAgmatccEntry(entry) : entry.text);
    });
    const check = await verifyAgmatccLedger(ledger);
    const serverPart = remoteCount === null ? 'server: necitit' : remoteCount < 0 ? 'server: INDISPONIBIL' : `server: ${remoteCount} evenimente în fluxul AGMaTCC al acestui dispozitiv (alertele TCC provin din adevărul operațional, nu din acest flux)`;
    integrity.textContent = check.valid
      ? `Lanț hash local: VALID (${ledger.length} intrări locale${ledger.length === 0 ? ', registru local gol' : ''}) · ${serverPart}`
      : `Integritate: ÎNCĂLCATĂ la #${check.brokenAt} · ${serverPart}`;
    const syncedCount = Number(readJson<number>(SYNCED_KEY, 0));
    syncLabel.textContent = `Sincronizare cu operational-events: ${syncedCount}/${ledger.length}.`;
    questions.innerHTML = '';
    ledger.filter((e) => e.kind === 'voice-transcript-confirmed').slice(-10).reverse().forEach((e) => { const li = document.createElement('li'); li.textContent = e.text; questions.append(li); });
    if (!check.valid) alert('ledger-local', `integritate încălcată la #${check.brokenAt}`);
  };
  const append = async (kind: AgmatccEntryKind, text: string, entryProvenance: AgmatccProvenance, awaitSync = false) => {
    ledger = await appendAgmatccEntry(ledger, { kind, provenance: entryProvenance, text, language, actorId: ACTOR_ID });
    window.localStorage.setItem(AGMATCC_LEDGER_KEY, JSON.stringify(ledger));
    await render();
    if (awaitSync) {
      try {
        const sync = await syncAgmatccLedger();
        await refreshRemoteCount();
        await render();
        return { status: sync.pending === 0 ? 'SYNCED' as const : 'PENDING' as const, acknowledged: sync.acknowledged, pending: sync.pending };
      } catch (error) {
        syncLabel.textContent = 'Sincronizare: indisponibilă, intrările rămân locale și se retrimit.';
        alert('operational-events/sync', error instanceof Error ? error.message : String(error));
        return { status: 'UNAVAILABLE' as const, acknowledged: 0, pending: 1 };
      }
    }
    syncAgmatccLedger().then(render).catch(() => { syncLabel.textContent = 'Sincronizare: indisponibilă, intrările rămân locale și se retrimit.'; alert('operational-events/sync', 'sincronizare indisponibilă; intrările rămân locale'); });
    return { status: 'PENDING' as const, acknowledged: 0, pending: 1 };
  };

  const searchInput = $<HTMLInputElement>('[data-agmatcc-query]');
  let serverTimer: number | undefined;
  let serverSeq = 0;
  const renderLocalSearchResults = (query: string) => {
    const seen = new Set<number>();
    const semanticHits = semanticSearchAgmatccLedger(ledger, query);
    const localResults = semanticHits.map((hit) => ({ index: hit.entry.index, text: hit.entry.text, source: hit.source }));
    semanticHits.forEach((hit) => {
      seen.add(hit.entry.index);
      const item = document.createElement('li');
      item.dataset.agmatccMode = 'semantic';
      item.textContent = `[semantic ${hit.score.toFixed(2)}${hit.matchedConcepts.length ? ` · concept: ${hit.matchedConcepts.join(', ')}` : ''}] #${hit.entry.index} · ${hit.entry.text} · sursă: ${hit.source}`;
      results.append(item);
    });
    const lexicalHits = searchAgmatccLedger(ledger, query).filter((hit) => !seen.has(hit.entry.index));
    lexicalHits.forEach((hit) => {
      localResults.push({ index: hit.entry.index, text: hit.entry.text, source: `agmatcc-local#${hit.entry.index}:${hit.entry.hash.slice(0, 12)}` });
      const item = document.createElement('li');
      item.dataset.agmatccMode = 'lexical';
      item.textContent = `[lexical] #${hit.entry.index} · ${hit.entry.text}`;
      results.append(item);
    });
    return localResults;
  };
  const renderServerSearchResults = (data: Awaited<ReturnType<typeof searchServerSemantic>>) => {
    const header = document.createElement('li');
    header.dataset.agmatccMode = 'server-semantic-coverage';
    header.textContent = `[server semantic] ${data.hits.length} rezultate · acoperire ${data.coverage.scanned}/${data.coverage.total} evenimente${data.coverage.complete ? '' : ' (PARȚIAL: doar cele mai recente)'}`;
    results.append(header);
    data.hits.forEach((hit) => {
      const item = document.createElement('li');
      item.dataset.agmatccMode = 'server-semantic';
      item.textContent = `[server ${hit.score.toFixed(2)}${hit.matchedConcepts.length ? ` · concept: ${hit.matchedConcepts.join(', ')}` : ''}] ${hit.eventType} · sursă: ${hit.source}`;
      results.append(item);
    });
  };
  const executeSemanticSearch = async (query: string) => {
    const normalized = query.trim();
    if (normalized.length < 2) throw new Error('AGMATCC_SEARCH_QUERY_TOO_SHORT');
    window.clearTimeout(serverTimer);
    const seq = ++serverSeq;
    searchInput.value = normalized;
    results.innerHTML = '';
    setState('searching');
    const localResults = renderLocalSearchResults(normalized);
    const server = await searchServerSemantic(normalized);
    if (seq === serverSeq) renderServerSearchResults(server);
    return { server, localResults };
  };
  const speakText = async (text: string, operationAudit?: string) => {
    const speechGeneration = ++playbackGeneration;
    if (!text || !('speechSynthesis' in window)) {
      if (!activeCommandTrace) status.textContent = 'Nu există text de redat sau redarea vocală nu este disponibilă.';
      return false;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    const voice = await waitForSpeechVoice(window.speechSynthesis, language);
    if (speechGeneration !== playbackGeneration) return false;
    if (!voice) {
      status.textContent = 'TTS: vocea pentru limba romana nu este disponibila; raspunsul ramane afisat.';
      void append('playback', 'TTS_FAILURE ROMANIAN_VOICE_UNAVAILABLE', 'system', true);
      return false;
    }
    utterance.voice = voice; utterance.rate = 0.95; utterance.pitch = 1;
    const commandTraceAtStart = activeCommandTrace;
    if (commandTraceAtStart) commandStage('PLAYBACK', 'redare rezultat în curs');
    else status.textContent = 'Redarea vocală este în curs.';
    utterance.onend = () => {
      if (speechGeneration !== playbackGeneration) return;
      setState('idle');
      resumeRequested = conversationEnabled;
      resumeListening();
      const completed = `PLAYBACK COMPLETED · ${operationAudit ?? text.slice(0, 200)}`;
      void append('playback', completed, 'system', true).then((journal) => {
        if (commandTraceAtStart && activeCommandTrace === commandTraceAtStart) {
          commandStage('PLAYBACK', `redare completă · jurnal ${journal.status}`);
          activeCommandTrace = null;
        } else if (!commandTraceAtStart && !conversationEnabled && speechGeneration === playbackGeneration) status.textContent = 'Redarea vocală s-a încheiat.';
      });
    };
    utterance.onerror = () => {
      if (speechGeneration !== playbackGeneration) return;
      setConversation(false);
      setState('idle');
      const failed = `PLAYBACK FAILED · ${operationAudit ?? 'manual playback'} · engine error`;
      void append('playback', failed, 'system', true).then((journal) => {
        if (commandTraceAtStart && activeCommandTrace === commandTraceAtStart) {
          commandStage('PLAYBACK', `FAILED — motorul vocal a raportat o eroare · JOURNAL ${journal.status}`);
          activeCommandTrace = null;
        } else if (!commandTraceAtStart) status.textContent = 'Redarea vocală a eșuat.';
      });
    };
    window.speechSynthesis.cancel(); setState('speaking'); window.speechSynthesis.speak(utterance);
    return true;
  };
  const speakCommandResult = async (spokenResult: string) => {
    status.textContent = spokenResult;
    const audit = activeCommandTrace?.join(' | ') ?? 'AGMaTCC command result';
    if (!('speechSynthesis' in window)) {
      commandStage('PLAYBACK', 'UNAVAILABLE — răspunsul rămâne vizibil în interfață');
      const journal = await append('note', `COMMAND_RESULT · ${audit} · RESPONSE: ${spokenResult} · PLAYBACK UNAVAILABLE`, 'system', true);
      commandStage('JOURNAL', journal.status === 'SYNCED' ? 'SYNCED' : `LOCAL ONLY · ${journal.status}`);
      activeCommandTrace = null;
      return;
    }
    commandStage('JOURNAL', 'append-only · aștept confirmarea sync înainte de TTS');
    const journal = await append('note', `COMMAND_RESULT · ${audit} · RESPONSE: ${spokenResult}`, 'system', true);
    commandStage('JOURNAL', journal.status === 'SYNCED' ? 'SYNCED' : `LOCAL ONLY · ${journal.status}`);
    if (!await speakText(spokenResult, audit)) {
      commandStage('PLAYBACK', 'UNAVAILABLE — răspunsul rămâne vizibil în interfață');
      activeCommandTrace = null;
    }
  };
  const runCommand = async (transcript: string, origin: 'voice' | 'typed' | 'button'): Promise<boolean> => {
    activeCommandTrace = [];
    auditTrace.replaceChildren();
    commandStage('TRANSCRIBED', `${origin} · ${transcript.trim().length} caractere; transcriptul nu se persistă automat`);
    const command = parseAgmatccVoiceCommand(transcript);
    if (command.type === 'none') {
      commandStage('INTENT_RESOLVED', 'NONE — textul rămâne transcriere, nu execut comandă');
      status.textContent = 'Nu am recunoscut o comandă executabilă; nimic nu a fost rulat.';
      activeCommandTrace = null;
      return false;
    }
    if (command.type === 'clarify') {
      commandStage('INTENT_RESOLVED', 'CLARIFICATION_REQUIRED');
      speakCommandResult(command.question);
      return true;
    }

    commandStage('INTENT_RESOLVED', command.type);
    try {
      if (command.type === 'read-governance' || command.type === 'read-risk-knowledge') {
        const moduleId = command.type === 'read-governance' ? 'governance' : 'risk-knowledge';
        const generation = beginTurnModuleRead(moduleId);
        try {
          const read = await readGovernanceModule(moduleId, command.type === 'read-risk-knowledge' ? command.query : undefined);
          if (!updateTurnModuleReadState(moduleId, 'CONNECTED_READ_ONLY', `${read.checkedAt} · ${read.path} · ${read.requestId ?? ''}`, generation)) return true;
          commandStage('AUTHORIZED', `identitate umană legată · GET ${read.path}`);
          showOperationRows('governance-read', read.records.map(row => JSON.stringify(row)));
          commandStage('EXECUTED', `read-only · ${read.records.length} înregistrări; fără activare sau aprobare`);
          speakCommandResult(summarizeGovernanceRead(read));
        } catch (error) {
          if (!updateTurnModuleReadState(moduleId, governanceReadFailure(error), '', generation)) return true;
          throw error;
        }
      } else if (command.type === 'read-remote-journal') {
        const journal = await readRemoteAgmatccJournal();
        commandStage('AUTHORIZED', `${journal.scope} · ${journal.source}`);
        const lines = [
          `Endpoint: ${journal.endpoint}`,
          `Stream ID: ${journal.streamId}`,
          `Server version: ${journal.serverVersion}`,
          `Scope: ${journal.scope}`,
          ...journal.events.map((event) =>
            `eventId=${event.eventId} · eventType=${event.eventType} · aggregateVersion=${event.aggregateVersion} · recordedAt=${event.recordedAt} · ledgerHash=${event.ledgerHash ?? '(indisponibil)'} · text=${event.text} · source=${event.source}`),
        ];
        showOperationRows('server-journal', lines);
        commandStage('EXECUTED', `read-only · ${journal.count} evenimente citite · ${journal.source}`);
        speakCommandResult(summarizeAgmatccJournal(journal));
      } else if (command.type === 'read-last-event' || command.type === 'read-event-detail') {
        const journal = await readRemoteAgmatccJournal();
        commandStage('AUTHORIZED', `${journal.scope} · ${journal.source}`);
        const event = command.type === 'read-event-detail' && command.eventId
          ? journal.events.find((candidate) => candidate.eventId === command.eventId)
          : [...journal.events].sort((a, b) => b.aggregateVersion - a.aggregateVersion)[0];
        const lines = [
          `Endpoint: ${journal.endpoint}`,
          `Stream ID: ${journal.streamId}`,
          ...journal.events.map((candidate) =>
            `eventId=${candidate.eventId} · eventType=${candidate.eventType} · aggregateVersion=${candidate.aggregateVersion} · recordedAt=${candidate.recordedAt} · ledgerHash=${candidate.ledgerHash ?? '(indisponibil)'} · text=${candidate.text} · source=${candidate.source}`),
        ];
        showOperationRows('server-journal', lines);
        if (command.type === 'read-last-event') {
          const latest = [...journal.events].sort((a, b) => b.aggregateVersion - a.aggregateVersion)[0];
          const response = latest ? describeAgmatccEvent(latest) : summarizeAgmatccJournal(journal);
          commandStage('EXECUTED', latest ? 'ultimul eveniment citit' : 'jurnal fără evenimente');
          speakCommandResult(response);
        } else if (command.field === 'endpoint') {
          auditPanel.open = true;
          resultsDetails.open = true;
          commandStage('EXECUTED', 'endpoint exact afișat');
          speakCommandResult(`Endpointul exact este ${journal.endpoint}.`);
        } else if (command.field === 'audit') {
          auditPanel.open = true;
          resultsDetails.open = true;
          commandStage('EXECUTED', `${journal.count} evenimente afișate pentru audit`);
          speakCommandResult('Detaliile complete de audit sunt afișate în secțiunea tehnică.');
        } else if (!event) {
          commandStage('EXECUTED', 'evenimentul solicitat nu a fost găsit');
          speakCommandResult(command.eventId
            ? 'Evenimentul cu identificatorul solicitat nu se află în jurnalul citit.'
            : 'Jurnalul nu conține evenimente, deci nu există un identificator disponibil.');
        } else if (command.field === 'id') {
          auditPanel.open = true;
          resultsDetails.open = true;
          commandStage('EXECUTED', 'identificator exact afișat la cerere');
          speakCommandResult(event.eventId);
        } else {
          auditPanel.open = true;
          resultsDetails.open = true;
          commandStage('EXECUTED', event.ledgerHash ? 'amprentă exactă afișată la cerere' : 'amprentă indisponibilă în înregistrare');
          speakCommandResult(event.ledgerHash ?? 'Înregistrarea citită nu conține un hash de eveniment.');
        }
      } else if (command.type === 'list-incidents') {
        const journal = await readLatestIncidents();
        commandStage('AUTHORIZED', `${journal.scope} · ${journal.source}`);
        const lines = [
          `${journal.source} · ${journal.scope} · ${journal.coverage} · ${journal.count} records · checkedAt=${journal.checkedAt}`,
          ...journal.incidents.map((incident) =>
            `id=${incident.id} · status=${incident.status} · severity=${incident.severity} · createdAt=${incident.createdAt} · title=${incident.title} · description=${incident.description ?? ''} · transportJobId=${incident.transportJobId ?? ''}`),
        ];
        showOperationRows('incident-journal', lines);
        commandStage('EXECUTED', `read-only · ${journal.count} înregistrări citite · ${journal.source}`);
        speakCommandResult(summarizeIncidentJournal(journal));
      } else if (command.type === 'read-tcc-alerts') {
        const snapshot = await readTccAlertSnapshot();
        commandStage('AUTHORIZED', `snapshot read-only · ${snapshot.source}`);
        const lines = snapshot.alerts.map((item) => `${item.alertClass} · ${item.message} · ${item.observedAt ?? 'timestamp indisponibil'} · ${item.source}${item.ref ? ` · ref ${item.ref}` : ''}`);
        showOperationRows('tcc-alerts', [`${snapshot.source} · status ${snapshot.status} · freshness ${snapshot.freshness} · ${snapshot.observedAt}`, ...lines]);
        commandStage('EXECUTED', `read-only · ${lines.length} alerte derivate · ${snapshot.source}`);
        speakCommandResult(summarizeTccAlerts(snapshot));
      } else if (command.type === 'search' || command.type === 'search-agmatcc-events') {
        const query = command.query;
        const search = await executeSemanticSearch(query);
        commandStage('AUTHORIZED', 'GET /operational-events/search/semantic · scope company-operational-events');
        const hits = search.server.hits;
        const serverLines = hits.map((hit) => `${hit.eventType} · score ${hit.score.toFixed(2)} · ${hit.matchedConcepts.join(', ') || 'fără concept potrivit'} · ${hit.source}`);
        const coverage = `${search.server.coverage.scanned}/${search.server.coverage.total}${search.server.coverage.complete ? ' complete' : ' parțial'}`;
        const localLines = search.localResults.slice(0, 3).map((hit) => `local #${hit.index} ${hit.text} · ${hit.source}`);
        showOperationRows('semantic-search', [
          `Query: ${query} · server coverage: ${coverage} · local matches: ${search.localResults.length}`,
          ...serverLines,
          ...localLines,
        ]);
        commandStage('EXECUTED', `${hits.length} rezultate server · acoperire ${coverage} · ${search.localResults.length} potriviri locale`);
        speakCommandResult(summarizeSemanticSearch(search));
      } else if (command.type === 'play-last') {
        const entry = ledger[ledger.length - 1];
        if (!entry) throw new Error('AGMATCC_LOCAL_LEDGER_EMPTY');
        commandStage('AUTHORIZED', 'citire read-only din ledger-ul AGMaTCC local');
        commandStage('EXECUTED', `ultima intrare locală #${ledger.length - 1}`);
        speakCommandResult(summarizeLocalAgmatccEntry(entry));
      } else {
        const link = [...root.querySelectorAll<HTMLAnchorElement>('[data-agmatcc-journal]')]
          .find((anchor) => foldText(anchor.textContent ?? '').includes(command.target));
        if (!link) throw new Error(`JOURNAL_LINK_NOT_FOUND:${command.target}`);
        commandStage('AUTHORIZED', 'navigare read-only în link-ul existent TURN');
        link.click();
        commandStage('EXECUTED', `navigare la ${link.textContent ?? command.target}`);
        speakCommandResult(`Am deschis ${link.textContent ?? command.target}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = Number(/HTTP_(401|403)\b/.exec(message)?.[1] ?? (error as { status?: number } | null)?.status);
      if (statusCode === 401 || statusCode === 403) {
        commandStage('BLOCKED', `HTTP ${statusCode} · ${message}`);
        alert('voice-command/authorization', message);
        speakCommandResult('Accesul la această informație a fost refuzat. Nu am executat operațiunea.');
      } else {
        commandStage('FAILED', message);
        alert('voice-command/execution', message);
        speakCommandResult('Nu am putut finaliza citirea. Nicio concluzie nu este disponibilă; detaliile tehnice sunt păstrate pentru audit.');
      }
    }
    return true;
  };
  $('[data-agmatcc-run-command]').addEventListener('click', () => {
    void runCommand(draft.value, 'typed').then((resolved) => {
      if (!resolved) status.textContent = 'Nu am recunoscut o comandă executabilă; nimic nu a fost rulat.';
    });
  });
  $('[data-agmatcc-read-remote]').addEventListener('click', () => { void runCommand('citește jurnalul serverului', 'button'); });
  root.querySelector('[data-agmatcc-read-governance]')?.addEventListener('click', () => { void runCommand('citește governance', 'button'); });
  root.querySelector('[data-agmatcc-read-rk]')?.addEventListener('click', () => { void runCommand('citește evaluările RK', 'button'); });

  let captureStopped = false;
  let captureTimer: ReturnType<typeof setTimeout> | undefined;
  const startCapture = () => {
    if (!sameSession()) { context.clear(); sessionIdentity = readSessionIdentity(); }
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) { setConversation(false); status.textContent = 'STT: browserul nu ofera transcriere vocala. Introducerea manuala ramane disponibila.'; return; }
    if (aiSend.disabled) { status.textContent = 'Asteapta raspunsul curent inainte de o noua intrebare.'; return; }
    playbackGeneration++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    captureStopped = false;
    resumeRequested = false;
    let submitted = false;
    let failed = false;
    let heard = false;
    const current = new Ctor() as RecognitionLike;
    recognition = current;
    current.lang = language; current.interimResults = true; current.continuous = false;
    current.onstart = () => { if (recognition !== current) return; setState('listening'); status.textContent = 'Ascult. Transcrierea apare mai jos.'; };
    current.onresult = (event) => {
      if (recognition !== current || captureStopped) return;
      if (!sameSession() || !root.isConnected || root.closest('[hidden]')) { stopButton.click(); context.clear(); return; }
      const transcript = readRecognitionTranscript(event);
      heard = Boolean(transcript.text);
      draft.value = transcript.text;
      provenance = 'voice-capture';
      status.textContent = transcript.final ? 'Transcriere finalizata. Consult datele TURN.' : 'Transcriere in curs...';
      if (transcript.final && !submitted) {
        submitted = true;
        aiQuestion.value = transcript.final;
        void askAi(transcript.final, true, 'voice');
      }
    };
    current.onerror = (event) => {
      if (recognition !== current) return;
      failed = true;
      setConversation(false);
      const code = String(event.error ?? 'unknown');
      status.textContent = `STT: ${speechRecognitionFailure(code)}`;
      alert('STT', code);
      void append('note', `STT_FAILURE ${JSON.stringify({ code, language })}`, 'system', true);
    };
    current.onend = () => {
      if (recognition !== current) return;
      recognition = null;
      clearTimeout(captureTimer); captureButton.disabled = false;
      if (!submitted) {
        setConversation(false);
        setState('idle');
        if (!failed && !captureStopped) status.textContent = heard
          ? 'STT: transcrierea nu a fost finalizata. Verifica textul si trimite intrebarea.'
          : 'STT: ascultarea s-a incheiat fara transcriere. Nicio cerere AI nu a fost trimisa.';
      }
      resumeListening();
    };
    captureButton.disabled = true; status.textContent = 'Pornesc microfonul...';
    try {
      current.start();
      captureTimer = setTimeout(() => { if (recognition === current && !submitted && !captureStopped) current.stop(); }, 30000);
    } catch (error) {
      recognition = null; setConversation(false);
      captureButton.disabled = false; setState('idle');
      status.textContent = `STT: ${error instanceof Error ? error.message : 'Pornire esuata'}`;
    }
  };
  captureButton.addEventListener('click', startCapture);
  stopButton.addEventListener('click', () => {
    setConversation(false);
    playbackGeneration++; captureStopped = true; clearTimeout(captureTimer); const stopped = recognition; recognition = null; stopped?.stop();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    captureButton.disabled = false; setState('idle');
    status.textContent = 'Oprit. Răspunsurile deja primite rămân în jurnal.';
  });
  conversationButton.addEventListener('click', () => {
    if (conversationEnabled) { stopButton.click(); return; }
    if (aiSend.disabled) { status.textContent = 'Așteaptă încheierea cererii curente.'; return; }
    stopButton.click(); setConversation(true); startCapture();
  });
  $('[data-agmatcc-new-conversation]').addEventListener('click', () => {
    stopButton.click(); context.clear(); lastAiAnswer = ''; aiQuestion.value = ''; draft.value = '';
    aiAnswer.textContent = ''; aiEvidence.replaceChildren();
    status.textContent = 'Conversație nouă. Cu ce te pot ajuta?';
  });
  let pageWasVisible = true;
  const stopDetached = new MutationObserver(() => {
    const visible = root.isConnected && !root.closest('[hidden]');
    if (!visible && pageWasVisible) { stopButton.click(); context.clear(); }
    pageWasVisible = visible;
    if (!root.isConnected) stopDetached.disconnect();
  });
  stopDetached.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  const visibilityChanged = () => {
    if (!root.isConnected) { document.removeEventListener('visibilitychange', visibilityChanged); return; }
    if (document.hidden) stopButton.click();
  };
  document.addEventListener('visibilitychange', visibilityChanged);
  draft.addEventListener('input', () => { if (provenance === 'voice-capture' && !draft.value.trim()) provenance = 'typed'; });
  $('[data-agmatcc-confirm]').addEventListener('click', () => {
    const text = draft.value.trim();
    if (!text) { status.textContent = 'Nimic de înregistrat.'; return; }
    const kind: AgmatccEntryKind = provenance === 'voice-capture' ? 'voice-transcript-confirmed' : 'note';
    const before = status.textContent;
    void append(kind, text, provenance).then(() => {
      if (draft.value.trim() === text) { draft.value = ''; provenance = 'typed'; }
      if (status.textContent === before) status.textContent = 'Înregistrat.';
    });
  });
  $('[data-agmatcc-speak]').addEventListener('click', () => speakText(lastAiAnswer || draft.value.trim()));
  const runServerSearch = (query: string) => {
    const seq = ++serverSeq;
    window.clearTimeout(serverTimer);
    if (query.trim().length < 2) return;
    serverTimer = window.setTimeout(() => {
      searchServerSemantic(query).then((data) => {
        if (seq !== serverSeq) return;
        renderServerSearchResults(data);
      }).catch((error: Error) => {
        if (seq !== serverSeq) return;
        const li = document.createElement('li');
        li.dataset.agmatccMode = 'server-semantic-unavailable';
        li.textContent = `[server semantic] INDISPONIBIL (${error.message}) — se afișează doar căutarea locală.`;
        results.append(li);
      });
    }, 350);
  };
  $<HTMLInputElement>('[data-agmatcc-query]').addEventListener('input', (event) => {
    const query = (event.target as HTMLInputElement).value;
    setState(query.trim() ? 'searching' : 'idle');
    results.innerHTML = '';
    runServerSearch(query);
    renderLocalSearchResults(query);
  });
  void render();
  void refreshBackendAlerts();
  void refreshRemoteCount().then(render);
  syncAgmatccLedger().then(refreshRemoteCount).then(render).catch(() => undefined);
}
