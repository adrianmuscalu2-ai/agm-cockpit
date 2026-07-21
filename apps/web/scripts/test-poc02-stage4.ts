import assert from 'node:assert/strict';
import { afterDepartureCopy } from '../src/poc02-after-departure/after-departure.i18n';
import {
  afterDepartureStateCatalog,
  presentAssessment,
  scenarioOptions,
  transitionAssessment,
} from '../src/poc02-after-departure/after-departure.presenter';
import {
  afterDeparturePolicies,
  assessAfterDepartureSituation,
} from '../src/poc02-after-departure/after-departure.evaluator';
import { renderAfterDepartureView } from '../src/poc02-after-departure/after-departure.view';
import { readFileSync } from 'node:fs';

for (const language of ['ro', 'de', 'en'] as const) {
  assert.equal(scenarioOptions(language).length, 8);
  assert.equal(Object.keys(afterDepartureCopy[language].states).length, 9);
  assert.equal(Object.keys(afterDepartureCopy[language].scenarios).length, 8);
}
assert.equal(afterDepartureStateCatalog.length, 9);
assert.equal(new Set(afterDepartureStateCatalog).size, 9);

const assessment = assessAfterDepartureSituation({
  scenario: 'route',
  safeToInteract: true,
  immediateDanger: false,
  externalActionRequested: true,
  facts: { observedRestriction: '3.5 t', approximateLocation: 'A3' },
});
const presented = presentAssessment(assessment, 'en');
assert.equal(presented.state, 'AWAITING_CONFIRMATION');
assert.equal(presented.confirmationRequired, true);
assert.equal(presented.externalEffectExecuted, false);
assert.equal(presented.canContinue, false);
assert.ok(presented.actions.length <= 3);
assert.equal(presented.actions[0], 'Follow signs and do not enter the uncertain route.');
assert.equal(presented.prohibitedActions[0], 'Do not ignore local signs.');
assert.equal(presented.limitations[0].startsWith('AGM provides'), true);

const escalated = transitionAssessment(assessment, 'ESCALATED');
assert.equal(escalated.state, 'ESCALATED');
const stabilized = transitionAssessment(escalated, 'SAFE_TO_CONTINUE');
assert.equal(stabilized.state, 'SAFE_TO_CONTINUE');
assert.equal(stabilized.canContinue, true);
const closed = transitionAssessment(stabilized, 'CLOSED');
assert.equal(closed.state, 'CLOSED');
assert.equal(transitionAssessment(closed, 'ASSESSED').state, 'CLOSED');

const html = renderAfterDepartureView({
  language: 'ro',
  scenario: 'route',
  safeToInteract: true,
  immediateDanger: false,
  externalActionRequested: true,
  online: false,
  facts: { observedRestriction: '3,5 t', approximateLocation: 'A3' },
  assessment,
});
assert.ok(html.includes('offline-banner'));
assert.ok(html.includes('AWAITING_CONFIRMATION') === false);
assert.ok(html.includes('Așteaptă confirmarea'));
assert.ok(html.includes('Nimic nu este trimis'));
assert.ok(html.includes('data-after-departure-fact="observedRestriction"'));
assert.ok(html.includes('priority-p2'));
assert.ok(html.includes('data-after-departure-transition="ESCALATED"'));
assert.equal(html.includes('data-after-departure-transition="SAFE_TO_CONTINUE"'), false);

const assessedHtml = renderAfterDepartureView({
  language: 'en',
  scenario: 'route',
  safeToInteract: true,
  immediateDanger: false,
  externalActionRequested: false,
  online: true,
  facts: { observedRestriction: '3.5 t', approximateLocation: 'A3' },
  assessment: assessAfterDepartureSituation({
    scenario: 'route',
    safeToInteract: true,
    immediateDanger: false,
    facts: { observedRestriction: '3.5 t', approximateLocation: 'A3' },
  }),
});
assert.ok(assessedHtml.includes('data-after-departure-transition="SAFE_TO_CONTINUE"'));
assert.equal(/[ăâîșțĂÂÎȘȚ]/.test(assessedHtml), false);
assert.equal((html.match(/<li>/g) ?? []).length > 0, true);

const unsafeHtml = renderAfterDepartureView({
  language: 'de',
  scenario: 'language',
  safeToInteract: false,
  immediateDanger: false,
  externalActionRequested: false,
  online: true,
  facts: {},
  assessment: assessAfterDepartureSituation({
    scenario: 'language',
    safeToInteract: false,
    immediateDanger: false,
  }),
});
assert.ok(unsafeHtml.includes('Unsichere Interaktion'));

for (const scenario of Object.keys(afterDeparturePolicies) as Array<keyof typeof afterDeparturePolicies>) {
  const facts = Object.fromEntries(
    afterDeparturePolicies[scenario].requiredFacts.map((fact) => [fact, 'confirmed']),
  );
  const localizedAssessment = assessAfterDepartureSituation({
    scenario,
    safeToInteract: true,
    immediateDanger: false,
    facts,
  });
  for (const language of ['de', 'en'] as const) {
    const localized = presentAssessment(localizedAssessment, language);
    assert.equal(/[ăâîșțĂÂÎȘȚ]/.test([
      ...localized.actions,
      ...localized.prohibitedActions,
      ...localized.limitations,
      ...localized.escalation,
      ...localized.missingFacts,
    ].join(' ')), false, `${scenario}/${language} contains untranslated Romanian content`);
  }
}

const viteConfig = readFileSync(new URL('../vite.config.mjs', import.meta.url), 'utf8');
assert.ok(viteConfig.includes('data-poc02-entry="after-departure"'));
assert.ok(viteConfig.includes('href="/after-departure.html"'));

const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const premiumSource = readFileSync(new URL('../src/premium-foundation.ts', import.meta.url), 'utf8');
assert.equal(mainSource.includes('class="home-action home-action-after-departure"'), false);
assert.equal(mainSource.includes('data-poc02-entry="after-departure"'), false);
assert.equal(mainSource.includes('href="/after-departure.html"'), false);
assert.ok(premiumSource.includes("href: '/after-departure.html'"));
assert.equal(mainSource.includes('data-module="after-departure"'), false);

console.log('POC 02 stage 4 presentation tests passed.');
