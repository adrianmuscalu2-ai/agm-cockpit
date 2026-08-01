import assert from 'node:assert/strict';
import { createIncidentController } from '../src/incident/incident.controller';
import { incidentReconciliationContract, reconcileIncidentJournal } from '../src/incident/incident-reconciliation';
import { emptyIncidentFilters, type OperationalIncident } from '../src/incident-journal';

function incident(id: string, status: OperationalIncident['status'], updatedAt: string): OperationalIncident {
  return {
    id,
    occurredAt: '2026-08-01T08:00:00.000Z',
    updatedAt,
    module: 'API',
    environments: ['API'],
    category: 'technical',
    symptom: 'Diagnostic',
    severity: 'major',
    reproduction: 'Reproducere',
    cause: '',
    attemptedSolutions: '',
    appliedSolution: status === 'validated' ? 'Remediere' : '',
    owner: 'Turn Operations',
    fixedInVersion: '',
    tests: status === 'validated' ? 'Teste PASS' : '',
    humanValidation: status === 'validated' ? 'Remote claim' : '',
    preventiveMeasure: '',
    status,
    relatedIncidentIds: [],
    reusableSolution: false,
    history: [],
  };
}

assert.equal(incidentReconciliationContract.remoteAuthority, 'API-006');

const local = incident('INC-1', 'analysis', '2026-08-01T09:00:00.000Z');
const remoteTerminal = incident('INC-1', 'validated', '2026-08-01T10:00:00.000Z');
const held = reconcileIncidentJournal([local], [remoteTerminal], new Date('2026-08-01T10:01:00.000Z'));
assert.equal(held.incidents[0].status, 'ready-test');
assert.equal(held.heldForHumanValidation, 1);
assert.equal(held.incidents[0].history.at(-1)?.action, 'reconciliation-held');

const newerLocal = incident('INC-2', 'remediation', '2026-08-01T11:00:00.000Z');
const olderRemote = incident('INC-2', 'analysis', '2026-08-01T10:00:00.000Z');
const localWins = reconcileIncidentJournal([newerLocal], [olderRemote]);
assert.equal(localWins.incidents[0].status, 'remediation');
assert.equal(localWins.localWins, 1);

const remoteNew = incident('INC-3', 'new', '2026-08-01T12:00:00.000Z');
const imported = reconcileIncidentJournal([], [remoteNew]);
assert.equal(imported.imported, 1);
assert.equal(imported.incidents[0].id, 'INC-3');

const state = { incidents: [local], incidentFilters: emptyIncidentFilters(), status: '' };
let writes = 0;
let renders = 0;
const controller = createIncidentController({
  state,
  render: () => { renders += 1; },
  persist: () => { writes += 1; },
  actor: () => 'Tester',
});
const controllerResult = controller.reconcile([remoteTerminal]);
assert.equal(controllerResult.heldForHumanValidation, 1);
assert.equal(writes, 1);
assert.equal(renders, 1);
assert.match(state.status, /validării umane/);

console.log('APP-010 Incident Journal reconciliation: PASS');
