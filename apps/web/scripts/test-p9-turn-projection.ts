import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateP9TurnProjection } from '../src/p9-turn-projection';

const projection = validateP9TurnProjection(JSON.parse(await readFile('public/operational/p9-turn-projection.json', 'utf8')));
assert.equal(projection.state, 'ACTIVE');
assert.deepEqual(projection.smoke, { passed: 5, total: 5, errors: 0, timeouts: 0 });
assert.equal(projection.killSwitch, 'ACTIVE');
assert.equal(projection.rollback, 'READY');
assert.equal(projection.source.kind, 'OPERATIONAL_EVIDENCE');
assert.throws(() => validateP9TurnProjection({ ...projection, state: 'STOPPED' }), /P9_TURN_OPERATIONAL_PROJECTION_INVALID/);
console.log('P9 Turn operational projection contract: PASS');
