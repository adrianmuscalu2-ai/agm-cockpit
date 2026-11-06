import assert from 'node:assert/strict';
import { appendAgmatccEntry, searchAgmatccLedger, type AgmatccEntry } from '../src/turn-agmatcc/agmatcc.ledger';
import { embedText, semanticSearchAgmatccLedger, SEMANTIC_DIMENSIONS } from '../src/turn-agmatcc/agmatcc.semantic';

const texts = [
  'Camionul a avut o avarie la frontiera, marfa ramasa blocata',
  'Soferul a depus documentele CMR la vama',
  'Taxa de peaj a fost achitata pentru ruta Bucuresti Viena',
  'Lansare versiune 1.9.1 confirmata',
];

let ledger: AgmatccEntry[] = [];
for (const text of texts) ledger = await appendAgmatccEntry(ledger, { kind: 'note', provenance: 'typed', text, language: 'ro-RO', actorId: 'test' });

const a = embedText('întârziere camion');
assert.equal(a.length, SEMANTIC_DIMENSIONS);
assert.deepEqual([...a], [...embedText('întârziere camion')], 'embedding must be deterministic');

const semantic = semanticSearchAgmatccLedger(ledger, 'incident vehicul');
assert.equal(semantic[0]?.entry.index, 0, 'synonym concepts (incident~avarie, vehicul~camion) must rank the avarie entry first');
assert.equal(searchAgmatccLedger(ledger, 'incident vehicul').length, 0, 'lexical search alone finds nothing: the semantic result is not lexical');
assert.ok(semantic[0].matchedConcepts.length >= 1 && semantic[0].source.startsWith('agmatcc-semantic-hash-v1#0:'), 'hit carries concepts and source');

assert.equal(semanticSearchAgmatccLedger(ledger, 'taxe rovinieta')[0]?.entry.index, 2);
assert.equal(semanticSearchAgmatccLedger(ledger, 'aprobare')[0]?.entry.index === 3, false, 'unrelated concept must not match release entry');
assert.equal(semanticSearchAgmatccLedger(ledger, 'zzqx').length, 0, 'no match yields no hits');
assert.equal(semanticSearchAgmatccLedger([], 'incident').length, 0);

console.log('AGMaTCC semantic gates: PASS');
