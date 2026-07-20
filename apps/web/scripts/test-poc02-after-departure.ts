import assert from 'node:assert/strict';
import {
  afterDeparturePolicies,
  assessAfterDepartureSituation,
  canTransitionAfterDeparture,
} from '../src/poc02-after-departure/after-departure.evaluator';
import { afterDepartureModule } from '../src/poc02-after-departure/after-departure.module';
import type { AfterDepartureScenario } from '../src/poc02-after-departure/after-departure.types';

const completeFacts: Record<AfterDepartureScenario, Record<string, string | boolean>> = {
  'road-control': { authorityRequest: 'Permis', approximateLocation: 'A3 km 20' },
  incident: { approximateLocation: 'A1 km 10', injuriesKnown: false },
  breakdown: { observedSymptom: 'Martor roșu', approximateLocation: 'B10' },
  fatigue: { observedSymptoms: 'Somnolență', safeStopAvailable: true },
  cargo: { observedCargoIssue: 'Zgomot', leakKnown: false },
  route: { observedRestriction: 'Limită 3,5 t', approximateLocation: 'Centru' },
  weather: { observedCondition: 'Gheață', safeStopAvailable: true },
  language: { sourceText: 'Kontrolle', targetLanguage: 'ro' },
};

const scenarios = Object.keys(afterDeparturePolicies) as AfterDepartureScenario[];

assert.equal(scenarios.length, 8);
assert.equal(afterDepartureModule.enabled, false);
assert.equal(afterDepartureModule.externalSideEffects, false);
assert.equal(afterDepartureModule.scenarios.length, 8);

for (const scenario of scenarios) {
  const assessed = assessAfterDepartureSituation({
    scenario,
    safeToInteract: true,
    immediateDanger: false,
    facts: completeFacts[scenario],
  });

  assert.equal(assessed.state, 'ASSESSED', `${scenario} should be assessed`);
  assert.equal(assessed.missingFacts.length, 0, `${scenario} should have all facts`);
  assert.equal(assessed.confirmationRequired, false);
  assert.equal(assessed.canContinue, false);
  assert.ok(assessed.immediateActions.length >= 1);
  assert.ok(assessed.immediateActions.length <= 3);
  assert.ok(assessed.prohibitedActions.length >= 1);
  assert.equal(assessed.limitations.length, 3);
}

const needsFacts = assessAfterDepartureSituation({
  scenario: 'route',
  safeToInteract: true,
  immediateDanger: false,
  facts: { approximateLocation: 'A8' },
});
assert.equal(needsFacts.state, 'NEEDS_FACTS');
assert.deepEqual(needsFacts.missingFacts, ['observedRestriction']);

const unsafe = assessAfterDepartureSituation({
  scenario: 'language',
  safeToInteract: false,
  immediateDanger: false,
});
assert.equal(unsafe.state, 'UNSAFE_TO_INTERACT');
assert.equal(unsafe.priority, 'P1');
assert.equal(unsafe.confirmationRequired, false);
assert.equal(unsafe.escalation.length, 0);

const emergency = assessAfterDepartureSituation({
  scenario: 'weather',
  safeToInteract: false,
  immediateDanger: true,
  facts: { observedCondition: 'Inundație' },
});
assert.equal(emergency.state, 'EMERGENCY');
assert.equal(emergency.priority, 'P0');
assert.equal(emergency.canContinue, false);
assert.equal(emergency.confirmationRequired, true);
assert.ok(emergency.escalation.includes('serviciu-urgență'));
assert.equal(new Set(emergency.escalation).size, emergency.escalation.length);

const awaitingConfirmation = assessAfterDepartureSituation({
  scenario: 'road-control',
  safeToInteract: true,
  immediateDanger: false,
  externalActionRequested: true,
  facts: completeFacts['road-control'],
});
assert.equal(awaitingConfirmation.state, 'AWAITING_CONFIRMATION');
assert.equal(awaitingConfirmation.confirmationRequired, true);

assert.equal(canTransitionAfterDeparture('NEW', 'NEEDS_FACTS'), true);
assert.equal(canTransitionAfterDeparture('NEEDS_FACTS', 'AWAITING_CONFIRMATION'), true);
assert.equal(canTransitionAfterDeparture('AWAITING_CONFIRMATION', 'ESCALATED'), true);
assert.equal(canTransitionAfterDeparture('CLOSED', 'ASSESSED'), false);
assert.equal(canTransitionAfterDeparture('EMERGENCY', 'SAFE_TO_CONTINUE'), false);
assert.equal(canTransitionAfterDeparture('SAFE_TO_CONTINUE', 'EMERGENCY'), true);

console.log('POC 02 after-departure stage 3 tests passed.');

