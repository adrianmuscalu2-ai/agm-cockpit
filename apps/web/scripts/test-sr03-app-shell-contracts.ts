import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  appStateFieldOwnership,
  appStateSliceNames,
} from '../src/app-shell/app-state.contract';
import {
  appEntrypointRegistry,
  appViewModuleRegistry,
} from '../src/app-shell/view-module.registry';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const stateContract = readFileSync(
  new URL('../src/app-shell/app-state.contract.ts', import.meta.url),
  'utf8',
);
const moduleContract = readFileSync(
  new URL('../src/app-shell/view-module.contract.ts', import.meta.url),
  'utf8',
);
const moduleRegistry = readFileSync(
  new URL('../src/app-shell/view-module.registry.ts', import.meta.url),
  'utf8',
);

const stateBlock = between(
  main,
  'const state = attachMailLegacyFacade(attachTranslatorLegacyFacade(attachContactsLegacyFacade(attachOcrLegacyFacade(attachIncidentsLegacyFacade({',
  '\n}, incidentsState), ocrState), contactsState), translatorState), mailState);',
);
const currentFields = [...stateBlock.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)]
  .map((match) => match[1]);
currentFields.push(...appStateFieldOwnership.incidents);
currentFields.push(...appStateFieldOwnership.ocr);
currentFields.push(...appStateFieldOwnership.contacts);
currentFields.push(...appStateFieldOwnership.translator);
currentFields.push(...appStateFieldOwnership.mail);
currentFields.sort();
const ownedFields = appStateSliceNames
  .flatMap((slice) => appStateFieldOwnership[slice])
  .sort();

assert.equal(currentFields.length, 65);
assert.equal(ownedFields.length, 65);
assert.equal(new Set(ownedFields).size, 65, 'Every state field must have one owner');
assert.deepEqual(ownedFields, currentFields);

assert.deepEqual(appStateSliceNames, [
  'shell',
  'profile',
  'contacts',
  'mail',
  'translator',
  'ocr',
  'corrector',
  'voice',
  'admin',
  'incidents',
  'guidance',
]);
assert.ok(stateContract.includes('export type AppState = {'));
assert.ok(stateContract.includes('export type LegacyAppStateFacade ='));
assert.ok(
  [...stateContract.matchAll(/^import .* from /gm)]
    .every((match) => match[0].startsWith('import type ')),
  'The state contract may only import types',
);

assert.ok(moduleContract.includes('render(context:'));
assert.ok(moduleContract.includes('bind(context:'));
assert.ok(moduleContract.includes('dispose?(context:'));

const expectedViews = [
  'home',
  'basic',
  'ocr',
  'access',
  'premium',
  'premiumTeam',
  'premiumLoadSafety',
  'cockpit',
  'email',
  'profile',
  'corrector',
  'turn',
  'legal',
  'about',
  'roadmap',
  'licenses',
].sort();
const registeredViews = appViewModuleRegistry.map((entry) => entry.view).sort();
assert.deepEqual(registeredViews, expectedViews);
assert.equal(new Set(registeredViews).size, registeredViews.length);
assert.ok(appViewModuleRegistry.every((entry) => entry.activation === 'legacy-main'));

assert.deepEqual(
  appEntrypointRegistry.map((entry) => [entry.id, entry.html, entry.activation]),
  [
    ['main', 'index.html', 'legacy-main'],
    ['beforeDeparture', 'before-departure.html', 'external-entrypoint'],
    ['afterDeparture', 'after-departure.html', 'external-entrypoint'],
  ],
);
assert.doesNotMatch(moduleRegistry, /^(?:import|export\s+\{)[\s\S]*?from\s+/m);
assert.doesNotMatch(main, /app-shell\/(?:app-state|view-module)/);

console.log('SR-03 app-shell contracts: PASS');

function between(value: string, startMarker: string, endMarker: string) {
  const start = value.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = value.indexOf(endMarker, start);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return value.slice(start, end);
}
