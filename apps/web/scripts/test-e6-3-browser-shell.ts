import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPreDepartureSession,
  transitionPreDeparture,
} from '../src/pre-departure/pre-departure.machine';
import { renderPreDepartureShell } from '../src/pre-departure/pre-departure.shell';
import {
  applyPreDepartureAnswer,
  completePreDepartureAssessment,
} from '../src/pre-departure/pre-departure.controller';
import {
  incidentJournalStorageKey,
  readIncidentJournal,
} from '../src/incident-journal';
import { monitoringAgents } from '../src/monitoring-department';
import { turnDepartments } from '../src/turn-command-center';

const htmlEntry = readFileSync(new URL('../before-departure.html', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.mjs', import.meta.url), 'utf8');
const premiumSource = readFileSync(new URL('../src/premium-foundation.ts', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../src/pre-departure/pre-departure.controller.ts', import.meta.url), 'utf8');
const turnOperationsSource = readFileSync(new URL('../src/turn-command-center.view.ts', import.meta.url), 'utf8');
const incidentJournalSource = readFileSync(new URL('../src/incident-journal.ts', import.meta.url), 'utf8');
const closureRegistrySource = readFileSync(new URL('../src/operational-closure.registry.ts', import.meta.url), 'utf8');
const turnNavigationSource = readFileSync(new URL('../src/turn-navigation.ts', import.meta.url), 'utf8');
const operationsHealthConfiguration = JSON.parse(
  readFileSync(new URL('../../../config/operations-health.json', import.meta.url), 'utf8'),
) as {
  operationsServices: Array<{ id: string; staticStatus?: string; healthyStatus?: string; displayStatus?: string; showInOperations?: boolean }>;
};

assert.ok(htmlEntry.includes('id="before-departure-app"'));
assert.ok(htmlEntry.includes('/src/pre-departure/pre-departure.entry.ts'));
assert.equal(mainSource.includes('href="/before-departure.html"'), false);
assert.equal(mainSource.includes('data-e6-entry="before-departure"'), false);
assert.ok(viteConfig.includes("beforeDeparture: 'before-departure.html'"));
assert.ok(premiumSource.includes('before-departure'));
assert.ok(controllerSource.includes("root.addEventListener('click'"));
assert.ok(controllerSource.includes("root.addEventListener('change'"));
assert.ok(controllerSource.includes("target.closest<HTMLButtonElement>('button')"));
assert.ok(turnOperationsSource.includes('operationsHealthSources.map'));
assert.ok(turnOperationsSource.includes('operation-service-changed'));
assert.ok(turnOperationsSource.includes('alerte active · ${archived} incidente validate/arhivate'));
assert.equal(turnDepartments.find((department) => department.id === 'monitoring')?.status, 'active');
assert.equal(monitoringAgents.length, 12);
assert.deepEqual(
  monitoringAgents.map((agent) => agent.code),
  Array.from({ length: 12 }, (_, index) => `MON-${String(index + 1).padStart(3, '0')}`),
);
const securityMonitoringAgent = monitoringAgents.find((agent) => agent.id === 'monitor-security');
assert.ok(securityMonitoringAgent);
assert.ok(securityMonitoringAgent.securityChecks?.length === 6);
assert.equal(JSON.stringify(securityMonitoringAgent).includes('AGM_TURN_ADMIN_PIN_HASH'), false);
assert.equal(JSON.stringify(securityMonitoringAgent).includes('OPENAI_API_KEY'), false);
assert.ok(turnNavigationSource.includes('window.scrollY < 600'));
assert.ok(turnNavigationSource.includes("behavior: 'smooth'"));
assert.deepEqual(
  operationsHealthConfiguration.operationsServices
    .filter((service) => service.showInOperations !== false)
    .map((service) => service.id),
  ['server-primary', 'server-backup', 'api', 'browser', 'android', 'ai', 'databases'],
);
assert.equal(
  operationsHealthConfiguration.operationsServices.find((service) => service.id === 'server-backup')?.staticStatus,
  'NOT CONFIGURED',
);
assert.equal(
  operationsHealthConfiguration.operationsServices.find((service) => service.id === 'android')?.staticStatus,
  'NOT IMPLEMENTED',
);
assert.equal(
  operationsHealthConfiguration.operationsServices.find((service) => service.id === 'server-backup')?.displayStatus,
  'BACKUP ENDPOINT NOT CONFIGURED',
);
assert.equal(
  operationsHealthConfiguration.operationsServices.find((service) => service.id === 'android')?.displayStatus,
  'CLIENT ONLINE · TELEMETRY NOT CONFIGURED',
);
assert.ok(incidentJournalSource.includes("preventiveMeasure: 'Rulare pnpm audit:ui-live"));
assert.ok(incidentJournalSource.includes("status: 'archived'"));
assert.ok(closureRegistrySource.includes(
  "{ id: 'AGM-FU-20260725-UILIVE', owner: 'Frontend Experience / QA', status: 'closed'",
));

const incidentStorageValues = new Map<string, string>();
const incidentStorage = {
  getItem: (key: string) => incidentStorageValues.get(key) ?? null,
  setItem: (key: string, value: string) => incidentStorageValues.set(key, value),
} as unknown as Storage;
const officialIncidents = readIncidentJournal(incidentStorage);
const staleIncidents = officialIncidents.map((incident) =>
  incident.id === 'AGM-FU-20260725-UILIVE'
    ? { ...incident, status: 'ready-test' as const, updatedAt: '2026-07-25T17:19:00.000Z' }
    : incident,
);
incidentStorageValues.set(incidentJournalStorageKey, JSON.stringify(staleIncidents));
const reconciledIncidents = readIncidentJournal(incidentStorage);
assert.equal(
  reconciledIncidents.find((incident) => incident.id === 'AGM-FU-20260725-UILIVE')?.status,
  'archived',
);

const initialHtml = renderPreDepartureShell(createPreDepartureSession());
assert.ok(initialHtml.includes('data-e6-entry="before-departure"'));
assert.ok(initialHtml.includes('data-before-departure-state>NOT_STARTED'));
assert.ok(initialHtml.includes('data-before-departure-start'));
assert.equal(initialHtml.match(/data-before-departure-start/g)?.length, 1);
assert.ok(initialHtml.includes('data-pre-departure-action="start" data-before-departure-start'));
assert.ok(initialHtml.includes('class="pre-departure-agm-topbar"'));
assert.ok(initialHtml.includes('src="/images/images/logo1.png"'));
assert.ok(initialHtml.includes('href="/premium"'));
assert.ok(initialHtml.includes('nu transmite date'));
assert.ok(initialHtml.includes('E6.6'));

const started = transitionPreDeparture(createPreDepartureSession(), { type: 'START_SESSION' });
assert.equal(started.transitionId, 'E6-T01');
const startedHtml = renderPreDepartureShell(started.session);
assert.ok(startedHtml.includes('data-before-departure-state>CONTEXT_SELECTION'));
assert.equal(startedHtml.includes('data-before-departure-start'), false);
assert.ok(startedHtml.includes('E6.4'));

const selected = transitionPreDeparture(started.session, {
  type: 'SELECT_CONTEXT',
  contexts: ['local'],
  applicableCheckIds: ['vehicle', 'driver'],
});
assert.equal(selected.applied, true);
const withProblem = applyPreDepartureAnswer(selected.session, 'vehicle', 'problem', 'ro');
const withSecondAnswer = applyPreDepartureAnswer(withProblem.session, 'driver', 'confirmed', 'ro');
const blocked = completePreDepartureAssessment(withSecondAnswer.session);
assert.equal(blocked.session.state, 'BLOCKED');
const repaired = applyPreDepartureAnswer(blocked.session, 'vehicle', 'confirmed', 'ro');
assert.equal(repaired.applied, true);
assert.equal(repaired.transitionId, 'E6-T12');
assert.equal(repaired.session.state, 'READY_TO_CONFIRM');
const reopened = applyPreDepartureAnswer(repaired.session, 'driver', 'problem', 'ro');
assert.equal(reopened.applied, true);
assert.equal(reopened.transitionId, 'E6-T14');
assert.equal(reopened.session.state, 'NEEDS_ATTENTION');

const naSession = applyPreDepartureAnswer(selected.session, 'vehicle', 'na', 'ro');
const naHtml = renderPreDepartureShell(naSession.session);
assert.ok(naHtml.includes('Neaplicabil'));
assert.equal(naHtml.includes('Not applicable for this context'), false);

const cleanFirst = applyPreDepartureAnswer(selected.session, 'vehicle', 'confirmed', 'ro');
const cleanSecond = applyPreDepartureAnswer(cleanFirst.session, 'driver', 'confirmed', 'ro');
const confirmed = completePreDepartureAssessment(cleanSecond.session);
assert.equal(confirmed.applied, true);
assert.equal(confirmed.transitionId, 'E6-T15');
assert.equal(confirmed.session.state, 'CONFIRMED');

console.log('E6.3 Browser navigation and shell tests passed.');
