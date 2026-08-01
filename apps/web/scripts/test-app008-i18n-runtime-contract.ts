import assert from 'node:assert/strict';
import { appI18nDictionary } from '../src/i18n/app-i18n.dictionary';
import { t, uiLanguageFromProfile } from '../src/i18n/app-i18n';
import { i18nCatalogRegistry, supportedUiLanguages } from '../src/i18n/i18n-catalog.registry';

assert.deepEqual([...supportedUiLanguages], ['ro', 'de', 'en']);
assert.deepEqual(i18nCatalogRegistry.map((catalog) => catalog.id), [
  'app', 'premium', 'pre-departure', 'after-departure',
]);

for (const language of supportedUiLanguages) {
  assert.equal(uiLanguageFromProfile(language), language);
}

const testKey = 'app008.runtime.repeated-placeholder';
for (const language of supportedUiLanguages) {
  appI18nDictionary[language][testKey] = '{value}/{value}/{count}';
  assert.equal(t(language, testKey, { value: language, count: 2 }), `${language}/${language}/2`);
  delete appI18nDictionary[language][testKey];
}

const fallbackKey = 'home.title';
assert.equal(t('fr' as never, fallbackKey), appI18nDictionary.ro[fallbackKey]);
assert.equal(t('ro', 'app008.unknown-key'), 'app008.unknown-key');

console.log('APP-008 I18n runtime languages, catalogs, interpolation and fallbacks: PASS');
