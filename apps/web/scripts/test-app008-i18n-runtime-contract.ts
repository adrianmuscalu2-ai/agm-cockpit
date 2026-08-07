import assert from 'node:assert/strict';
import { appI18nDictionary } from '../src/i18n/app-i18n.dictionary';
import { t, uiLanguageFromProfile } from '../src/i18n/app-i18n';
import { i18nCatalogRegistry, supportedUiLanguages } from '../src/i18n/i18n-catalog.registry';

assert.deepEqual([...supportedUiLanguages], ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq']);
assert.deepEqual(i18nCatalogRegistry.map((catalog) => catalog.id), [
  'app', 'premium', 'pre-departure', 'after-departure',
]);

for (const language of supportedUiLanguages) {
  assert.equal(uiLanguageFromProfile(language), language);
}

const testKey = 'app008.runtime.repeated-placeholder';
for (const language of supportedUiLanguages) {
  const dictionary = appI18nDictionary[language] ?? (appI18nDictionary[language] = {});
  dictionary[testKey] = '{value}/{value}/{count}';
  assert.equal(t(language, testKey, { value: language, count: 2 }), `${language}/${language}/2`);
  delete dictionary[testKey];
}

const fallbackKey = 'home.title';
assert.equal(t('fr', fallbackKey), 'Accueil');
assert.equal(t('fr', 'about.scopeBody'), appI18nDictionary.en?.['about.scopeBody']);
assert.equal(t('ro', 'app008.unknown-key'), 'app008.unknown-key');

console.log('APP-008 I18n runtime languages, catalogs, interpolation and fallbacks: PASS');
