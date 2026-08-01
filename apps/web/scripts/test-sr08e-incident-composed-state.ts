import assert from 'node:assert/strict';
import {
  attachIncidentsLegacyFacade,
  createIncidentsState,
  incidentsStateFields,
} from '../src/app-shell/incidents-state.store';
import { createIncidentController } from '../src/incident/incident.controller';
import { emptyIncidentFilters, type IncidentDraft } from '../src/incident-journal';

const incidents = createIncidentsState({
  incidents: [],
  incidentFilters: emptyIncidentFilters(),
});
const legacy = attachIncidentsLegacyFacade({ status: '' }, incidents);

legacy.incidentFilters = { ...emptyIncidentFilters(), module: 'legacy' };
assert.equal(incidents.incidentFilters.module, 'legacy');
incidents.incidentFilters = { ...emptyIncidentFilters(), module: 'canonical' };
assert.equal(legacy.incidentFilters.module, 'canonical');

for (const field of incidentsStateFields) {
  const descriptor = Object.getOwnPropertyDescriptor(legacy, field);
  assert.equal(typeof descriptor?.get, 'function');
  assert.equal(typeof descriptor?.set, 'function');
  assert.equal('value' in (descriptor ?? {}), false);
}

let writes = 0;
const controller = createIncidentController({
  state: legacy,
  incidentsState: incidents,
  render: () => undefined,
  persist: () => { writes += 1; },
  actor: () => 'Tester',
});
const draft: IncidentDraft = {
  occurredAt: '2026-07-29T10:00:00.000Z',
  module: 'Web',
  environments: ['Web'],
  category: 'technical',
  symptom: 'Test',
  severity: 'minor',
  reproduction: 'Steps',
  cause: '',
  attemptedSolutions: '',
  appliedSolution: '',
  owner: 'Tester',
  fixedInVersion: '',
  tests: '',
  humanValidation: '',
  preventiveMeasure: '',
  status: 'new',
  relatedIncidentIds: [],
  reusableSolution: false,
};
const saved = controller.save(draft, '', '');
assert.equal(incidents.incidents.length, 1);
assert.equal(legacy.incidents, incidents.incidents);
controller.reopen(saved.id, 'Retest');
assert.equal(incidents.incidents[0].status, 'reopened');
controller.setFilters({ ...emptyIncidentFilters(), module: 'Web' });
assert.equal(incidents.incidentFilters.module, 'Web');
controller.clearFilters();
assert.equal(incidents.incidentFilters.module, '');
assert.match(controller.exportAudit(), /recordCount/);
assert.equal(writes, 2);

console.log('SR-08E Incident composed state and legacy facade: PASS');
