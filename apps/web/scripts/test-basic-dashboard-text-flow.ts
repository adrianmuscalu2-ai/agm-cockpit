import assert from 'node:assert/strict';
import { analyzeDashboardText, formatDashboardTextResult } from '../src/basic-photo-analysis/dashboard-text.analysis';

const critical = analyzeDashboardText('STOP. Presiune ulei motor prea mică. Opriți imediat.', 82);
assert.equal(critical.status, 'identified');
assert.equal(critical.category, 'stop-critical');
assert.ok(critical.warnings.some((warning) => warning.includes('oprire')));
assert.deepEqual(critical.knowledgeReferences, ['KB-VEHICLE-WARN-001']);

const brake = analyzeDashboardText('Brake system fault. Error code EBS-42. Service.', 76);
assert.equal(brake.status, 'identified');
assert.equal(brake.category, 'brake-system');

const stopBrake = analyzeDashboardText('STOP\nBraking system fault', 40);
assert.equal(stopBrake.status, 'identified');
assert.equal(stopBrake.category, 'brake-system');
assert.match(stopBrake.summary, /STOP.*sistem/i);
assert.ok(stopBrake.recommendedActions.some((action) => action.includes('opre')));

const stopBrakeCorrectionTypo = analyzeDashboardText('STOP\nBracking system fault', 40);
assert.equal(stopBrakeCorrectionTypo.category, 'brake-system');
assert.ok(brake.facts.some((fact) => fact.label === 'Cod afișat' && fact.value === 'EBS-42'));
assert.ok(formatDashboardTextResult(brake).includes('Acțiuni recomandate'));

const uncertain = analyzeDashboardText('Mesaj neclar 123', 91);
assert.equal(uncertain.status, 'uncertain');
assert.equal(uncertain.category, undefined);
assert.ok(uncertain.recommendedActions.some((action) => action.includes('Refă fotografia')));

const visualOnly = analyzeDashboardText('simbol aprins', 95);
assert.equal(visualOnly.status, 'uncertain');
assert.ok(visualOnly.limitations.some((limit) => limit.includes('nu identifică simbolul vizual')));

console.log('AGM Basic Sprint 3 dashboard textual message analyzer: PASS');
