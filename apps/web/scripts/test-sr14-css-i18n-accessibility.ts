import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { appI18nDictionary } from '../src/i18n/app-i18n.dictionary';
import { i18nCatalogRegistry, supportedUiLanguages } from '../src/i18n/i18n-catalog.registry';
import { premiumI18nDictionary } from '../src/i18n/premium-i18n.dictionary';
import { preDepartureCopy } from '../src/pre-departure/pre-departure.i18n';
import { afterDepartureCopy } from '../src/poc02-after-departure/after-departure.i18n';

const cssModules = [
  '00-foundation.css',
  '10-shell.css',
  '20-domain-tools.css',
  '30-operations.css',
  '40-turn-responsive.css',
  '50-roadmap-responsive.css',
] as const;
const manifest = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
assert.deepEqual(
  [...manifest.matchAll(/@import '\.\/styles\/([^']+)'/g)].map((match) => match[1]),
  [...cssModules],
);
const reconstructedCss = cssModules
  .map((name) => readFileSync(new URL(`../src/styles/${name}`, import.meta.url)))
  .reduce((output, content) => Buffer.concat([output, content]), Buffer.alloc(0));
assert.equal(
  createHash('sha256').update(reconstructedCss).digest('hex').toUpperCase(),
  '2A676A4ED84022E5801150155B2F6E317892A15E45522F4CA3A972F4D8D39A4A',
  'The modular CSS must reconstruct the exact pre-SR-14 cascade.',
);

assert.deepEqual([...supportedUiLanguages], ['ro', 'de', 'en']);
assert.equal(i18nCatalogRegistry.length, 4);
for (const catalog of i18nCatalogRegistry) {
  assert.deepEqual([...catalog.languages], ['ro', 'de', 'en'], `${catalog.id} language coverage`);
}

assertCatalogParity('app', appI18nDictionary);
assertCatalogParity('premium', premiumI18nDictionary);
assertTopologyParity('pre-departure', preDepartureCopy);
assertTopologyParity('after-departure', afterDepartureCopy);

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const preDepartureShell = readFileSync(
  new URL('../src/pre-departure/pre-departure.shell.ts', import.meta.url),
  'utf8',
);
const afterDepartureView = readFileSync(
  new URL('../src/poc02-after-departure/after-departure.view.ts', import.meta.url),
  'utf8',
);
for (const [surface, source] of [
  ['main', main],
  ['pre-departure', preDepartureShell],
  ['after-departure', afterDepartureView],
] as const) {
  assert.match(source, /aria-label(?:ledby)?=/, `${surface} needs accessible names`);
  assert.match(source, /aria-live=|role="status"|role="dialog"/, `${surface} needs live/dialog semantics`);
}
assert.ok(main.includes('aria-modal="true"'));
assert.ok(preDepartureShell.includes('aria-pressed='));
assert.ok(afterDepartureView.includes('<label'));

console.log('SR-14 exact CSS cascade, RO/DE/EN completeness and accessibility smoke: PASS');

function assertCatalogParity(
  name: string,
  catalog: Record<string, Record<string, string>>,
) {
  const referenceKeys = Object.keys(catalog.ro).sort();
  for (const language of supportedUiLanguages) {
    const entries = catalog[language];
    assert.deepEqual(Object.keys(entries).sort(), referenceKeys, `${name}/${language} keys`);
    for (const key of referenceKeys) {
      assert.ok(entries[key].trim(), `${name}/${language}/${key} must not be empty`);
      assert.deepEqual(
        placeholders(entries[key]),
        placeholders(catalog.ro[key]),
        `${name}/${language}/${key} placeholders`,
      );
    }
  }
}

function assertTopologyParity(name: string, catalog: Record<string, unknown>) {
  const referencePaths = leafPaths(catalog.ro).sort();
  for (const language of supportedUiLanguages) {
    assert.deepEqual(leafPaths(catalog[language]).sort(), referencePaths, `${name}/${language} topology`);
  }
}

function leafPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafPaths(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key));
  }
  assert.notEqual(value, '', `${prefix} must not be empty`);
  return [prefix];
}

function placeholders(value: string) {
  return [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
}
