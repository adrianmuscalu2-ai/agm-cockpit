import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appendAgmatccEntry, searchAgmatccLedger, toOperationalSyncItems, verifyAgmatccLedger, type AgmatccEntry } from '../src/turn-agmatcc/agmatcc.ledger';
import { renderAgmatccPage } from '../src/turn-agmatcc/agmatcc.view';
import { readAgmatccJournalStream, readLatestIncidents, readTccAlertSnapshot, searchServerSemantic } from '../src/turn-agmatcc/agmatcc.commands';

const input = { language: 'ro-RO', actorId: 'turn-admin-session' };
let ledger: AgmatccEntry[] = [];
ledger = await appendAgmatccEntry(ledger, { ...input, kind: 'voice-transcript-confirmed', provenance: 'voice-capture', text: 'Șoferul a confirmat încărcarea la București' });
ledger = await appendAgmatccEntry(ledger, { ...input, kind: 'note', provenance: 'typed', text: 'Verificare documente CMR' });
assert.equal((await verifyAgmatccLedger(ledger)).valid, true);

const tampered = ledger.map((e, i) => (i === 0 ? { ...e, text: 'altceva' } : e));
assert.deepEqual(await verifyAgmatccLedger(tampered), { valid: false, brokenAt: 0 });
await assert.rejects(appendAgmatccEntry(ledger, { ...input, kind: 'voice-transcript-confirmed', provenance: 'typed', text: 'x' }), /PROVENANCE/);
await assert.rejects(appendAgmatccEntry(ledger, { ...input, kind: 'note', provenance: 'typed', text: '  ' }), /EMPTY/);

assert.equal(searchAgmatccLedger(ledger, 'bucuresti incarcare')[0].entry.index, 0);
assert.equal(searchAgmatccLedger(ledger, 'inexistent').length, 0);

const items = toOperationalSyncItems(ledger, { streamId: crypto.randomUUID(), deviceId: crypto.randomUUID() }, 0);
assert.equal(items[1].expectedStreamVersion, 0);
assert.equal((items[1].event.integrity as { previousEventId?: string }).previousEventId, ledger[0].id);

const agmatccPage = renderAgmatccPage('<aside data-turn-module-navigation>TURN MODULES</aside>');
assert.ok(agmatccPage.includes('<section class="turn-agmatcc-page" aria-labelledby="turn-agmatcc-title">'));
assert.ok(agmatccPage.includes('<div class="agmatcc-content" data-turn-page="agmatcc">'));
assert.ok(agmatccPage.includes('data-turn-module-navigation'));
assert.ok(agmatccPage.includes('data-open-turn-page="incidents"'));
assert.ok(agmatccPage.includes('Risk &amp; Knowledge'));
assert.ok(agmatccPage.indexOf('data-turn-module-navigation') < agmatccPage.indexOf('agmatcc-history-title'));
assert.ok(agmatccPage.includes('data-agmatcc-journal="version-journal"'));

const journalFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	assert.match(String(input), /\/operational-events\/stream-1\?afterVersion=-1$/);
	assert.equal(init?.cache, 'no-store');
	return new Response(JSON.stringify({ data: { streamId: 'stream-1', serverVersion: 0, events: [{
		eventId: 'event-1', eventType: 'agmatcc.voice-transcript-confirmed', aggregateVersion: 0,
		recordedAt: '2026-11-07T00:00:00.000Z', payload: { text: 'Incident verificat', provenance: 'voice-capture' },
	}] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const journal = await readAgmatccJournalStream('stream-1', journalFetch as typeof fetch);
assert.equal(journal.source, 'GET /operational-events/:streamId?afterVersion=-1');
assert.equal(journal.scope, 'AGMaTCC device stream; authorized read');
assert.equal(journal.events[0].text, 'Incident verificat');
assert.equal(journal.events[0].source, 'operational-event:stream-1@0');

const incidentsFetch = async (input: RequestInfo | URL) => {
	assert.match(String(input), /\/incidents$/);
	return new Response(JSON.stringify({ data: [{ id: 'incident-1', status: 'open', severity: 'high', title: 'Incident real', createdAt: '2026-11-07T00:00:00.000Z' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const incidents = await readLatestIncidents(incidentsFetch as typeof fetch);
assert.equal(incidents.source, 'API-006 GET /incidents');
assert.equal(incidents.scope, 'authenticated user company scope');
assert.equal(incidents.coverage, 'COMPLETE');
assert.equal(incidents.incidents[0].title, 'Incident real');
await assert.rejects(readLatestIncidents(async () => new Response('', { status: 403 }) as Response), /INCIDENT_JOURNAL_HTTP_403/);

const semanticFetch = async (input: RequestInfo | URL) => {
	assert.match(String(input), /\/operational-events\/search\/semantic\?q=AGMaTCC&limit=20$/);
	return new Response(JSON.stringify({ data: { hits: [{ eventType: 'agmatcc.note', score: 0.9, matchedConcepts: ['AGMaTCC'], source: 'operational-event:stream-1@0' }], coverage: { total: 1, scanned: 1, complete: true } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const semantic = await searchServerSemantic('AGMaTCC', semanticFetch as typeof fetch);
assert.equal(semantic.hits[0].source, 'operational-event:stream-1@0');
assert.deepEqual(semantic.coverage, { total: 1, scanned: 1, complete: true });
await assert.rejects(searchServerSemantic('AGMaTCC', async () => new Response('', { status: 403 }) as Response), /AGMATCC_SEMANTIC_HTTP_403/);

const operationalTruth = {
	generatedAt: '2026-11-07T00:00:00.000Z', overallStatus: 'PASS', reason: 'CURRENT', falseGreen: 0,
	unexplainedDegraded: 0, observedAt: '2026-11-07T00:00:00.000Z', freshness: 'LIVE', authStatus: 'M2M AUTHENTICATED',
	telemetryStatus: 'LIVE TELEMETRY', latestEvent: { agentId: 'agm.authority.control-plane', lifecycle: 'COMPLETED', sequence: 4, detail: 'Health verified', recordedAt: '2026-11-07T00:00:00.000Z', eventId: 'truth-event' },
} as never;
const alerts = await readTccAlertSnapshot(async () => operationalTruth);
assert.equal(alerts.source, 'GET /operations/turn/operational-truth');
assert.equal(alerts.status, 'PASS');
assert.equal(alerts.alerts[0].ref, 'truth-event');

const nav = readFileSync(new URL('../src/turn-command-navigation.ts', import.meta.url), 'utf8');
assert.ok(nav.includes("TURN_PAGES = ['agmatcc',"));
const view = readFileSync(new URL('../src/turn-command-center.view.ts', import.meta.url), 'utf8');
assert.ok(view.indexOf('renderAgmatccPage(renderTurnModuleNavigation())') < view.indexOf('renderFunctionalOverview()}'));
assert.ok(!view.includes('${renderTurnModuleNavigation()}\n'));
assert.ok(view.includes('data-open-turn-page="agmatcc"'));
assert.ok(view.includes("topbarOnlyModules = new Set(['incidents', 'version-journal', 'memory', 'evidence', 'risk-knowledge'])"));
import { parseAgmatccVoiceCommand } from '../src/turn-agmatcc/agmatcc.commands';
assert.deepEqual(parseAgmatccVoiceCommand('Comandă: caută Documente CMR'), { type: 'search', query: 'documente cmr' });
assert.deepEqual(parseAgmatccVoiceCommand('Citește jurnalul serverului.'), { type: 'read-remote-journal' });
assert.deepEqual(parseAgmatccVoiceCommand('Arată ultimele incidente'), { type: 'list-incidents' });
assert.deepEqual(parseAgmatccVoiceCommand('Caută evenimentele AGMaTCC'), { type: 'search-agmatcc-events', query: 'AGMaTCC' });
assert.deepEqual(parseAgmatccVoiceCommand('Ce alerte avem în TURN?'), { type: 'read-tcc-alerts' });
assert.deepEqual(parseAgmatccVoiceCommand('comanda reda ultima'), { type: 'play-last' });
assert.deepEqual(parseAgmatccVoiceCommand('comandă citește jurnal server'), { type: 'read-remote-journal' });
assert.deepEqual(parseAgmatccVoiceCommand('citește jurnalul'), { type: 'clarify', question: 'Care jurnal: jurnalul serverului AGMaTCC sau alt jurnal TURN?' });
assert.deepEqual(parseAgmatccVoiceCommand('caută'), { type: 'clarify', question: 'Ce vrei să caut?' });
assert.deepEqual(parseAgmatccVoiceCommand('deschide jurnal memorie'), { type: 'open-journal', target: 'memorie' });
assert.equal(parseAgmatccVoiceCommand('comanda sterge istoricul').type, 'none');
console.log('AGMaTCC gates: PASS');
