import assert from 'node:assert/strict';
import { createIncidentController } from '../src/incident/incident.controller';
import { emptyIncidentFilters, type IncidentDraft } from '../src/incident-journal';

const state = { incidents: [], incidentFilters: emptyIncidentFilters(), status: '' };
let writes = 0;
const controller = createIncidentController({
  state, render: () => undefined, persist: () => { writes += 1; }, actor: () => 'Tester',
});
const draft: IncidentDraft = {
  occurredAt: '2026-07-29T10:00:00.000Z', module: 'Web', environments: ['Web'],
  category: 'technical', symptom: 'Test', severity: 'minor', reproduction: 'Steps',
  cause: '', attemptedSolutions: '', appliedSolution: '', owner: 'Tester',
  fixedInVersion: '', tests: '', humanValidation: '', preventiveMeasure: '',
  status: 'new', relatedIncidentIds: [], reusableSolution: false,
};
const saved = controller.save(draft, '', '');
controller.reopen(saved.id, 'Retest');
assert.equal(state.incidents[0].status, 'reopened');
controller.setFilters({ ...emptyIncidentFilters(), module: 'Web' });
controller.clearFilters();
assert.match(controller.exportAudit(), /recordCount/);
assert.equal(writes, 2);
console.log('SR-07E Incident controller characterization: PASS');
