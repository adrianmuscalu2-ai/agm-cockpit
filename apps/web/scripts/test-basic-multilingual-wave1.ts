import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  basicLanguageCodes,
  basicLanguageRegistry,
  maximumBasicLanguageCapacity,
  normalizeQuickLanguages,
} from '../src/language-registry';
import { appI18nDictionary } from '../src/i18n/app-i18n.dictionary';
import { t } from '../src/i18n/app-i18n';
import { defaultProfile, normalizeLanguage, normalizeProfile, readProfile, saveProfile } from '../src/profileSettings';
import { emailTemplates, templateContent } from '../src/emailTemplates';

const expected = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq'] as const;
assert.deepEqual([...basicLanguageCodes], expected);
assert.equal(maximumBasicLanguageCapacity, 12);
assert.equal(12 - basicLanguageCodes.length, 3);
assert.equal(normalizeLanguage('it'), null);

for (const language of expected) {
  const definition = basicLanguageRegistry[language];
  assert.ok(definition.nativeLabel);
  assert.match(definition.speechLocale, /^[a-z]{2}-[A-Z]{2}$/);
  assert.match(definition.ocrCode, /^[a-z]{3}$/);
  assert.ok(t(language, 'home.title'));
  assert.ok(t(language, 'translator.title'));
  assert.ok(t(language, 'mail.moduleName'));
  assert.ok(t(language, 'profile.preferredLanguage'));
  assert.notEqual(t(language, 'home.title'), 'home.title');
  assert.ok(templateContent(emailTemplates[0], language).subject);
}

for (const language of ['fr', 'nl', 'ru', 'pl', 'tr', 'sq'] as const) {
  assert.ok(appI18nDictionary[language]?.['language.more']);
  assert.ok(appI18nDictionary[language]?.['language.favorites']);
}

const profile = normalizeProfile({ ...defaultProfile(), preferredLanguage: 'ru', favoriteLanguages: ['fr', 'ru', 'pl', 'tr'] });
assert.equal(profile.preferredLanguage, 'ru');
assert.deepEqual(profile.favoriteLanguages, ['fr', 'ru', 'pl']);
assert.equal(normalizeQuickLanguages(['sq', 'tr', 'pl']).length, 3);
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
};
saveProfile(storage, profile);
assert.equal(readProfile(storage).preferredLanguage, 'ru');
assert.deepEqual(readProfile(storage).favoriteLanguages, ['fr', 'ru', 'pl']);

const apiDto = readFileSync(new URL('../../api/src/translation/dto/translate-text.dto.ts', import.meta.url), 'utf8');
for (const language of expected) assert.match(apiDto, new RegExp(`['"]${language}['"]`));
for (const forbidden of ['it', 'es', 'hu']) assert.doesNotMatch(apiDto, new RegExp(`['"]${forbidden}['"]`));

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(main, /normalizeQuickLanguages/);
assert.match(main, /data-more-language/);
assert.doesNotMatch(main, /\['ro', 'de', 'en', 'fr'/);

console.log('AGM Basic multilingual Wave 1 contract: PASS');
