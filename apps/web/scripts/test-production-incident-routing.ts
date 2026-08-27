import assert from 'node:assert/strict';
import { activateIncidentRoute, assessProductOwnerEscalation, authorizeIncidentRoute, incidentRoutingRegistry, routeIncident } from '../src/incident-routing.registry';
import { monitoringFailureToIncident, type MonitoringEvent } from '../src/monitoring/monitoring-event.contract';
import { evaluateProductionPreflight, reconcileProductionPreflightIncident, type ProductionPreflightCheck } from '../src/production-preflight';
import { transitionIncident, updateIncident } from '../src/incident-journal';
import { renderActiveOperationsIncident } from '../src/turn-command-center.view';

const at = '2026-08-06T08:00:00.000Z';
const event: MonitoringEvent = {
  contract: 'agm-monitoring-event.v1', eventId: 'evt-ssh-lost', incidentId: 'AGM-OPS-PRODUCTION-ACCESS', kind: 'failure', occurredAt: at, detectedAt: at,
  monitorCode: 'MON-001', checkId: 'ssh-connectivity', component: 'Hetzner Production access', environment: 'API', category: 'infrastructure', severity: 'critical',
  summary: 'SSH Production access lost', observedResult: 'Port 22 unavailable', recommendedAction: 'Activate approved recovery procedure.',
};

const route = routeIncident(event);
assert.equal(route?.id, 'production-access');
assert.match(route?.recoveryChannel ?? '', /Hetzner API\/Rescue automatizat/);
assert.match(route?.recoveryChannel ?? '', /manuală.*interzisă/i);
assert.equal(route?.procedure.length, 6);
const automatic = activateIncidentRoute(route!);
assert.equal(automatic.find((item) => item.agentId === 'monitor-server-primary')?.status, 'ACTIVE');
assert.equal(automatic.find((item) => item.agentId === 'secret-credentials-guardian')?.status, 'AWAITING AUTHORIZATION');
assert.throws(() => authorizeIncidentRoute(automatic, { authorizationId: '', routeId: 'production-access', actor: '', authorizedAt: '' }));
const authorized = authorizeIncidentRoute(automatic, { authorizationId: 'TURN-AUTH-SSH-RECOVERY', routeId: 'production-access', actor: 'Turn Commander', authorizedAt: '2026-08-06T08:01:00.000Z' });
assert.equal(authorized.find((item) => item.agentId === 'secret-credentials-guardian')?.status, 'ACTIVE');

const apiRoute = incidentRoutingRegistry.find((item) => item.id === 'api-runtime')!;
const apiActivations = activateIncidentRoute(apiRoute);
assert.equal(apiActivations.find((item) => item.role === 'executor')?.status, 'ACTIVE');
assert.deepEqual(assessProductOwnerEscalation(apiRoute, []), { allowed: false, reason: 'INTERNAL_RECOVERY_REQUIRED' });
assert.deepEqual(assessProductOwnerEscalation(apiRoute, [{ mechanism: 'terminare administrativă WMI', outcome: 'PASS', safeDetail: 'Port 3000 recuperat.' }]), { allowed: false, reason: 'RECOVERED_INTERNAL' });
assert.deepEqual(assessProductOwnerEscalation(apiRoute, [], 'MAJOR_RISK'), { allowed: true, reason: 'MAJOR_RISK' });

const routedIncident = monitoringFailureToIncident(event);
assert.match(routedIncident.owner, /release-operations/);
assert.match(routedIncident.history[0]?.note ?? '', /secret-credentials-guardian:AWAITING AUTHORIZATION/);
const archivedIncident = { ...routedIncident, id: 'AGM-OLD-ARCHIVED', status: 'archived' as const, symptom: 'Incident istoric' };
const activePanel = renderActiveOperationsIncident([archivedIncident, routedIncident]);
assert.match(activePanel, /AGM-OPS-PRODUCTION-ACCESS/);
assert.doesNotMatch(activePanel, /AGM-OLD-ARCHIVED|Incident istoric/);
assert.match(activePanel, /release-operations/);
assert.match(activePanel, /secret-credentials-guardian/);
assert.match(activePanel, /Hetzner API\/Rescue automatizat/);

const check = (id: ProductionPreflightCheck['id'], status: ProductionPreflightCheck['status'], safeDetail: string, checkedAt: string): ProductionPreflightCheck => ({ id, status, safeDetail, checkedAt });
const failed = evaluateProductionPreflight([
  check('ssh-identity', 'PASS', 'Approved identity present.', at), check('ssh-agent', 'PASS', 'Agent active.', at),
  check('ssh-connectivity', 'FAIL', 'Port 22 unavailable.', at), check('console-rescue', 'PASS', 'Recovery available.', at),
  check('production-api', 'FAIL', 'Public API unavailable.', at), check('recovery-procedure', 'PASS', 'Procedure available.', at),
], at);
let incidents = reconcileProductionPreflightIncident([], failed);
assert.equal(incidents[0]?.status, 'new');

const recoveryAt = '2026-08-06T08:10:00.000Z';
const recovered = evaluateProductionPreflight((['ssh-identity', 'ssh-agent', 'ssh-connectivity', 'ssh-authentication', 'console-rescue', 'production-api', 'guardian-telemetry', 'recovery-procedure'] as const).map((id) => check(id, 'PASS', `${id} recovered.`, recoveryAt)), recoveryAt);
incidents = reconcileProductionPreflightIncident(incidents, recovered);
assert.equal(incidents[0]?.status, 'validated');

const current = incidents[0]!;
const validatedDraft = { ...current, humanValidation: 'Validated by independent operator.', status: 'ready-test' as const };
const withEvidence = updateIncident(current, validatedDraft, 'Independent Validator', 'Recovery evidence accepted.', new Date('2026-08-06T08:11:00.000Z'));
const closed = transitionIncident(withEvidence, 'validated', 'Independent Validator', 'Scenario validated and closed.', new Date('2026-08-06T08:12:00.000Z'));
assert.equal(closed.status, 'validated');

console.log('SSH lost -> detected -> routed -> activated -> authorized -> recovered -> validated: PASS');
