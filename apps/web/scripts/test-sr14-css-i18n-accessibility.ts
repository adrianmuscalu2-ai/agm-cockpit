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
  'D27B210081C5510D57CF65EB3F6899B54CC3319D48D4EE413BF91BFCA28069D3',
  'The modular CSS must reconstruct the approved Access/Premium and Android Wave 1 cascade.',
);

assert.deepEqual([...supportedUiLanguages], ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq']);
assert.equal(i18nCatalogRegistry.length, 4);
assert.deepEqual([...i18nCatalogRegistry[0].languages], [...supportedUiLanguages], 'app language coverage');
for (const catalog of i18nCatalogRegistry.slice(1)) {
  assert.deepEqual([...catalog.languages], ['ro', 'de', 'en'], `${catalog.id} language coverage`);
}

assertCatalogParity('app', appI18nDictionary as Record<string, Record<string, string>>, ['ro', 'de', 'en']);
assertCatalogParity('premium', premiumI18nDictionary, ['ro', 'de', 'en']);
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
for (const key of [
  'ocr.page.title',
  'ocr.page.description',
  'ocr.page.capture',
  'ocr.page.camera',
  'ocr.page.file',
  'ocr.page.result',
  'ocr.page.placeholder',
  'ocr.page.copy',
  'ocr.page.translate',
  'ocr.page.save',
  'ocr.page.clear',
  'ocr.page.archive',
  'ocr.page.empty',
  'ocr.page.open',
  'ocr.page.clearArchive',
  'ocr.page.local',
]) {
  assert.ok(main.includes(`'${key}'`), `OCR page must use ${key}`);
}
assert.match(main, /class="translator-hud ocr-page(?: [^"]+)?"[^>]*aria-labelledby="ocr-page-title"/);
assert.match(main, /aria-busy=/);
assert.match(main, /<textarea id="ocrExtractedText"/);
const domainCss = readFileSync(new URL('../src/styles/20-domain-tools.css', import.meta.url), 'utf8');
assert.match(domainCss, /\.ocr-page/);
assert.match(domainCss, /@media \(max-width: 520px\)/);
assert.match(domainCss, /:focus-visible/);
assert.ok(preDepartureShell.includes('aria-pressed='));
assert.ok(afterDepartureView.includes('<label'));

console.log('SR-14 exact CSS cascade, RO/DE/EN completeness and accessibility smoke: PASS');

function assertCatalogParity(
  name: string,
  catalog: Record<string, Record<string, string>>,
  languages: readonly string[] = supportedUiLanguages,
) {
  const referenceKeys = Object.keys(catalog.ro).sort();
  for (const language of languages) {
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
  for (const language of ['ro', 'de', 'en']) {
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
