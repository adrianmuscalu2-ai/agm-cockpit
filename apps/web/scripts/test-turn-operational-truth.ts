import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { operationalTruthIsPass, type TurnOperationalTruth } from '../src/turn-operational-truth';

const pass = {
  contractVersion: 'turn-operational-truth.v1',
  generatedAt: '2026-09-04T12:00:01.000Z',
  overallStatus: 'PASS',
  reason: 'AUTHENTICATED_M2M_ACP_READ_LIVE',
  falseGreen: 0,
  unexplainedDegraded: 0,
  observedAt: '2026-09-04T12:00:00.000Z',
  ageSeconds: 1,
  freshness: 'LIVE',
  authStatus: 'M2M AUTHENTICATED',
  telemetryStatus: 'LIVE TELEMETRY',
  authorityControlPlane: { canonicalId: 'agm.authority.control-plane', status: 'PASS', statusSource: 'M2M_AUTHENTICATED_ACP_READ', observedAt: '2026-09-04T12:00:00.000Z' },
  chain: {
    machineIdentity: { status: 'VERIFIED' },
    credential: { status: 'VERIFIED' },
    token: { status: 'VERIFIED' },
    authenticatedAcpRead: { status: 'PASS' },
    telemetry: { status: 'PASS' },
    eventStore: { status: 'PERSISTED' },
    api: { status: 'PASS' },
    turn: { status: 'EVIDENCE AVAILABLE' },
    ui: { status: 'READY FOR LIVE RENDER' },
  },
  latestEvent: null,
} satisfies TurnOperationalTruth;

assert.equal(operationalTruthIsPass(pass), true);
assert.equal(operationalTruthIsPass({ ...pass, falseGreen: 1 }), false);
assert.equal(operationalTruthIsPass({ ...pass, telemetryStatus: 'NO TELEMETRY' }), false);
assert.equal(operationalTruthIsPass({ ...pass, chain: { ...pass.chain, eventStore: { status: 'MISSING' } } }), false);
assert.equal(operationalTruthIsPass({ ...pass, chain: { ...pass.chain, api: { status: 'FAIL' } } }), false);
assert.equal(operationalTruthIsPass({ ...pass, chain: { ...pass.chain, turn: { status: 'NO TELEMETRY' } } }), false);
assert.equal(operationalTruthIsPass({ ...pass, chain: { ...pass.chain, ui: { status: 'NO TELEMETRY' } } }), false);

const liveStateSource = await readFile(new URL('../src/turn-agent-live-state.ts', import.meta.url), 'utf8');
assert.match(liveStateSource, /fetchTurnOperationalTruth\(fetcher\)/);
assert.doesNotMatch(liveStateSource, /\/agent-runtime-events\?/);
assert.doesNotMatch(liveStateSource, /\/auth\/refresh/);
assert.match(liveStateSource, /data-operational-step/);
assert.match(liveStateSource, /truth\.falseGreen/);

const governanceSource = await readFile(new URL('../src/premium-governance/premium-governance.runtime.ts', import.meta.url), 'utf8');
assert.match(governanceSource, /M2M AUTHENTICATED · LIVE/);
assert.match(governanceSource, /fetchTurnOperationalTruth\(\)/);
assert.match(governanceSource, /fără afirmație runtime|dovada M2M live/);

const commandCenterSource = await readFile(new URL('../src/turn-command-center.view.ts', import.meta.url), 'utf8');
assert.match(commandCenterSource, /REGISTRY ONLY · fără afirmație runtime/);
assert.match(commandCenterSource, /data-agent-live-evidence/);
assert.match(commandCenterSource, /data-component-live-evidence/);

console.log('TURN operational truth UI contract: PASS');
