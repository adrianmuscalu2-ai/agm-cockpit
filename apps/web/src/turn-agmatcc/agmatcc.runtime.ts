import { turnAdminAuthenticatedFetch } from '../admin-auth';
import './agmatcc.css';
import { parseAgmatccVoiceCommand } from './agmatcc.commands';
import {
  foldText, AGMATCC_LEDGER_KEY, AGMATCC_STREAM_KEY, appendAgmatccEntry, randomUuid, searchAgmatccLedger,
  toOperationalSyncItems, verifyAgmatccLedger, type AgmatccEntry, type AgmatccEntryKind, type AgmatccProvenance,
} from './agmatcc.ledger';

const SYNCED_KEY = 'agm.turn.agmatcc.synced-count.v1';
const ACTOR_ID = 'turn-admin-session';

type RecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; start(): void; stop(): void };

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
  const response = await fetcher(`/operational-events/${encodeURIComponent(stream().streamId)}?afterVersion=-1`, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AGMATCC_JOURNAL_HTTP_${response.status}`);
  const payload = await response.json() as { data?: { serverVersion?: number; events?: unknown[] } };
  return { serverVersion: payload.data?.serverVersion ?? -1, count: payload.data?.events?.length ?? 0 };
}

export function bindAgmatcc(language = 'ro-RO') {
  const root = document.querySelector<HTMLElement>('.turn-agmatcc-page');
  if (!root || root.dataset.agmatccBound) return;
  root.dataset.agmatccBound = '1';
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const draft = $<HTMLTextAreaElement>('[data-agmatcc-draft]');
  const status = $('[data-agmatcc-status]');
  const history = $('[data-agmatcc-history]');
  const results = $('[data-agmatcc-results]');
  const integrity = $('[data-agmatcc-integrity]');
  const syncLabel = $('[data-agmatcc-sync]');
  const captureButton = $<HTMLButtonElement>('[data-agmatcc-capture]');
  const stopButton = $<HTMLButtonElement>('[data-agmatcc-stop]');
  let ledger = readJson<AgmatccEntry[]>(AGMATCC_LEDGER_KEY, []);
  let provenance: AgmatccProvenance = 'typed';
  let recognition: RecognitionLike | null = null;
  const stage = $('.agmatcc-stage');
  const questions = $('[data-agmatcc-questions]');
  const alerts = $('[data-agmatcc-alerts]');
  const setState = (state: 'idle' | 'listening' | 'speaking' | 'searching') => { stage.dataset.agmatccState = state; };
  const alert = (source: string, message: string) => {
    const li = document.createElement('li');
    li.textContent = `[${source}] ${new Date().toISOString()} · ${message}`;
    alerts.prepend(li);
    while (alerts.children.length > 20) alerts.lastElementChild?.remove();
  };

  const render = async () => {
    history.innerHTML = ledger.slice().reverse().map((entry) =>
      `<li><small>#${entry.index} · ${entry.kind} · ${entry.provenance} · ${entry.occurredAt} · ${entry.hash.slice(0, 12)}</small><div></div></li>`).join('');
    [...history.children].forEach((li, i) => { li.querySelector('div')!.textContent = ledger[ledger.length - 1 - i].text; });
    const check = await verifyAgmatccLedger(ledger);
    integrity.textContent = check.valid ? `Integritate: VALID (${ledger.length} intrări)` : `Integritate: ÎNCĂLCATĂ la #${check.brokenAt}`;
    const syncedCount = Number(readJson<number>(SYNCED_KEY, 0));
    syncLabel.textContent = `Sincronizare cu operational-events: ${syncedCount}/${ledger.length}.`;
    questions.innerHTML = '';
    ledger.filter((e) => e.kind === 'voice-transcript-confirmed').slice(-10).reverse().forEach((e) => { const li = document.createElement('li'); li.textContent = `#${e.index} · ${e.text}`; questions.append(li); });
    if (!check.valid) alert('ledger-local', `integritate încălcată la #${check.brokenAt}`);
  };
  const append = async (kind: AgmatccEntryKind, text: string, entryProvenance: AgmatccProvenance) => {
    ledger = await appendAgmatccEntry(ledger, { kind, provenance: entryProvenance, text, language, actorId: ACTOR_ID });
    window.localStorage.setItem(AGMATCC_LEDGER_KEY, JSON.stringify(ledger));
    await render();
    syncAgmatccLedger().then(render).catch(() => { syncLabel.textContent = 'Sincronizare: indisponibilă, intrările rămân locale și se retrimit.'; alert('operational-events/sync', 'sincronizare indisponibilă; intrările rămân locale'); });
  };

  const searchInput = $<HTMLInputElement>('[data-agmatcc-query]');
  const runSearch = (query: string) => {
    setState('searching'); searchInput.value = query;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const speakText = (text: string) => {
    if (!text || !('speechSynthesis' in window)) { status.textContent = 'Nu există text de redat sau redarea vocală nu este disponibilă.'; return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.onend = () => setState('idle'); utterance.onerror = () => setState('idle');
    window.speechSynthesis.cancel(); setState('speaking'); window.speechSynthesis.speak(utterance);
    void append('playback', `Redare: ${text.slice(0, 200)}`, 'system');
  };
  const readRemote = async () => {
    try {
      const journal = await readRemoteAgmatccJournal();
      status.textContent = `Jurnal server: versiune ${journal.serverVersion}, ${journal.count} evenimente (local: ${ledger.length}).`;
    } catch (error) {
      status.textContent = `Jurnal server indisponibil: ${(error as Error).message}`; alert('operational-events/read', (error as Error).message);
    }
  };
  const runCommand = (transcript: string): boolean => {
    const command = parseAgmatccVoiceCommand(transcript);
    if (command.type === 'none') return false;
    if (command.type === 'search') { runSearch(command.query); status.textContent = `Comandă: căutare „${command.query}”.`; }
    else if (command.type === 'play-last') speakText(ledger[ledger.length - 1]?.text ?? '');
    else if (command.type === 'read-remote-journal') void readRemote();
    else {
      const link = [...root.querySelectorAll<HTMLAnchorElement>('[data-agmatcc-journal]')]
        .find((a) => foldText(a.textContent ?? '').includes(command.target));
      if (link) { status.textContent = `Comandă: deschid ${link.textContent}.`; link.click(); } else status.textContent = `Comandă: jurnal necunoscut „${command.target}”.`;
    }
    return true;
  };
  $('[data-agmatcc-run-command]').addEventListener('click', () => { if (!runCommand(draft.value)) status.textContent = 'Nu este o comandă (începe cu „comandă”).'; });
  $('[data-agmatcc-read-remote]').addEventListener('click', () => { void readRemote(); });

  captureButton.addEventListener('click', () => {
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) { status.textContent = 'Recunoașterea vocală nu este disponibilă pe acest dispozitiv; folosește introducerea manuală.'; return; }
    recognition = new Ctor() as RecognitionLike;
    recognition.lang = language; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => { draft.value = [...event.results].map((r: any) => r[0].transcript).join(' '); provenance = 'voice-capture'; status.textContent = runCommand(draft.value) ? 'Comandă vocală executată.' : 'Transcriere primită. Verific-o și confirmă.'; };
    recognition.onerror = (event) => { status.textContent = `Eroare captură: ${event.error ?? 'necunoscută'}`; };
    recognition.onend = () => { captureButton.disabled = false; setState('idle'); };
    captureButton.disabled = true; setState('listening'); status.textContent = 'Ascult…';
    recognition.start();
  });
  stopButton.addEventListener('click', () => { recognition?.stop(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setState('idle'); });
  draft.addEventListener('input', () => { if (provenance === 'voice-capture' && !draft.value.trim()) provenance = 'typed'; });
  $('[data-agmatcc-confirm]').addEventListener('click', () => {
    const text = draft.value.trim();
    if (!text) { status.textContent = 'Nimic de înregistrat.'; return; }
    const kind: AgmatccEntryKind = provenance === 'voice-capture' ? 'voice-transcript-confirmed' : 'note';
    void append(kind, text, provenance).then(() => { draft.value = ''; provenance = 'typed'; status.textContent = 'Înregistrat (append-only).'; });
  });
  $('[data-agmatcc-speak]').addEventListener('click', () => speakText(draft.value.trim() || ledger[ledger.length - 1]?.text));
  $<HTMLInputElement>('[data-agmatcc-query]').addEventListener('input', (event) => {
    const query = (event.target as HTMLInputElement).value;
    setState(query.trim() ? 'searching' : 'idle');
    results.innerHTML = '';
    searchAgmatccLedger(ledger, query).forEach((hit) => {
      const li = document.createElement('li');
      li.textContent = `#${hit.entry.index} · ${hit.entry.text}`;
      results.append(li);
    });
  });
  void render();
  syncAgmatccLedger().then(render).catch(() => undefined);
}
