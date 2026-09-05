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
const governanceViewSource = await readFile(new URL('../src/premium-governance/premium-governance.view.ts', import.meta.url), 'utf8');
assert.match(governanceSource, /\/operations\/turn\/operational-dashboard/);
assert.match(governanceSource, /Authorization: `Bearer \$\{turnAdminAccessToken\}`/);
assert.match(governanceSource, /Registry-ul nu este folosit ca fallback/);
assert.match(governanceSource, /node\.lastHeartbeat/);
assert.match(governanceSource, /node\.lastActivity/);
assert.match(governanceSource, /node\.activityFreshness/);
assert.match(governanceSource, /node\.currentOperation/);
assert.match(governanceSource, /node\.workloadState/);
assert.match(governanceSource, /node\.dependencyFailures/);
assert.match(governanceSource, /node\.incidents/);
assert.match(governanceSource, /Incidents\/errors/);
assert.match(governanceSource, /node\.evidence\.source/);
assert.match(governanceSource, /node\.runtimeEvidence\.source/);
assert.match(governanceSource, /node\.activityEvidence\.source/);
assert.match(governanceSource, /node\.requiredAction/);
assert.match(governanceSource, /node\.authorityState\.state/);
assert.match(governanceSource, /node\.registryPresence/);
assert.match(governanceSource, /data-registry-presence/);
assert.match(governanceSource, /data-runtime-running/);
assert.match(governanceSource, /data-runtime-not-running/);
assert.match(governanceSource, /data-health-healthy/);
assert.match(governanceSource, /data-health-degraded/);
assert.match(governanceSource, /data-health-failed/);
assert.match(governanceSource, /data-health-unknown/);
assert.match(governanceSource, /data-health-standby/);
assert.match(governanceSource, /node\.lifecycleStatus\)} \(identity only\)/);
assert.doesNotMatch(governanceSource, /M2M AUTHENTICATED · LIVE/);
assert.doesNotMatch(governanceSource, /orbit/i);
assert.match(governanceViewSource, /data-premium-operational-panel/);
assert.match(governanceViewSource, /data-operational-summary/);

const commandCenterSource = await readFile(new URL('../src/turn-command-center.view.ts', import.meta.url), 'utf8');
const authorityControlPlaneCss = await readFile(new URL('../src/premium-governance/turn-authority-control-plane.css', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(commandCenterSource, /REGISTRY ONLY · fără afirmație runtime/);
assert.match(commandCenterSource, /data-secondary-registry/);
assert.doesNotMatch(commandCenterSource, /turn-agent-panel\/index\.html/);
assert.doesNotMatch(commandCenterSource, /renderRealStatusBoard/);
const premiumPanelPosition = commandCenterSource.indexOf('${renderTurnAuthorityControlPlane()}');
const registryPosition = commandCenterSource.indexOf('${renderApprovedTurnDashboard(language)}');
assert(premiumPanelPosition >= 0 && registryPosition > premiumPanelPosition, 'Premium operational panel must precede the secondary registry.');
assert.match(authorityControlPlaneCss, /\.turn-secondary-registry:not\(\[open\]\)\s*>\s*:not\(summary\)\s*{\s*display:\s*none;/);
assert.match(mainSource, /void bindPremiumLinguisticAgentHeartbeats/);
assert.match(mainSource, /bindPremiumGovernanceRuntime\(state\.adminSession\.accessToken\)/);
assert.doesNotMatch(mainSource, /linguisticHeartbeatReady\.then/);

console.log('TURN operational truth UI contract: PASS');
