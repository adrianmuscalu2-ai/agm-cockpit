import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { turnCommandCenterContract } from '../src/turn-command-center.contract';

const viewSource = readFileSync(new URL('../src/turn-command-center.view.ts', import.meta.url), 'utf8');

assert.equal(turnCommandCenterContract.id, 'APP-011');
assert.equal(turnCommandCenterContract.mode, 'read-only');
assert.deepEqual(turnCommandCenterContract.dataSources, ['OPS-003 runtime telemetry', 'Production Preflight', 'Incident Journal', 'Governance Register']);
assert.equal(turnCommandCenterContract.delegatedMutations.administration, 'API-007');
assert.equal(turnCommandCenterContract.delegatedMutations.releaseDeploymentRollback, 'OPS-004');
assert.equal(turnCommandCenterContract.delegatedMutations.monitoringEvents, 'OPS-003');

assert.match(viewSource, /data-module-contract=/);
assert.match(viewSource, /data-operation-mode=/);
assert.match(viewSource, /turnCommandCenterContract\.dataSources/);
assert.doesNotMatch(viewSource, /\bfetch\s*\(/, 'The APP-011 view must not call operational APIs directly.');
assert.doesNotMatch(viewSource, /localStorage\.(?:setItem|removeItem|clear)\s*\(/, 'The APP-011 view must not mutate browser persistence directly.');
assert.match(viewSource, /renderTurnAuthorityControlPlane/);

console.log('APP-011 Turn Command Center contract: PASS');
