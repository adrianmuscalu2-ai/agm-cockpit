import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appendAgmatccEntry, searchAgmatccLedger, toOperationalSyncItems, verifyAgmatccLedger, type AgmatccEntry } from '../src/turn-agmatcc/agmatcc.ledger';
import { renderAgmatccPage } from '../src/turn-agmatcc/agmatcc.view';

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
assert.ok(agmatccPage.includes('data-turn-page="agmatcc"'));
assert.ok(agmatccPage.includes('data-turn-module-navigation'));
assert.ok(agmatccPage.includes('data-open-turn-page="incidents"'));
assert.ok(agmatccPage.includes('Risk &amp; Knowledge'));
assert.ok(agmatccPage.indexOf('data-turn-module-navigation') < agmatccPage.indexOf('agmatcc-history-title'));
assert.ok(agmatccPage.includes('data-agmatcc-journal="version-journal"'));
const nav = readFileSync(new URL('../src/turn-command-navigation.ts', import.meta.url), 'utf8');
assert.ok(nav.includes("TURN_PAGES = ['agmatcc',"));
const view = readFileSync(new URL('../src/turn-command-center.view.ts', import.meta.url), 'utf8');
assert.ok(view.indexOf('renderAgmatccPage(renderTurnModuleNavigation())') < view.indexOf('renderFunctionalOverview()}'));
assert.ok(!view.includes('${renderTurnModuleNavigation()}\n'));
assert.ok(view.includes('data-open-turn-page="agmatcc"'));
assert.ok(view.includes("topbarOnlyModules = new Set(['incidents', 'version-journal', 'memory', 'evidence', 'risk-knowledge'])"));
import { parseAgmatccVoiceCommand } from '../src/turn-agmatcc/agmatcc.commands';
assert.deepEqual(parseAgmatccVoiceCommand('Comandă: caută Documente CMR'), { type: 'search', query: 'documente cmr' });
assert.deepEqual(parseAgmatccVoiceCommand('comanda reda ultima'), { type: 'play-last' });
assert.deepEqual(parseAgmatccVoiceCommand('comandă citește jurnal server'), { type: 'read-remote-journal' });
assert.equal(parseAgmatccVoiceCommand('deschide jurnal memorie').type, 'none');
assert.equal(parseAgmatccVoiceCommand('comanda sterge istoricul').type, 'none');
console.log('AGMaTCC gates: PASS');
