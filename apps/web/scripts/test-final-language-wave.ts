import { basicLanguageCodes, basicLanguageRegistry, maximumBasicLanguageCapacity } from '../src/language-registry';
import { appI18nDictionary } from '../src/i18n/app-i18n.dictionary';
import { i18nCatalogRegistry } from '../src/i18n/i18n-catalog.registry';
import { carMoverI18nKeys, carMoverText } from '../src/car-mover/car-mover.i18n';
import { capabilityText, capabilityTextKeys } from '../src/premium-capabilities/capability.i18n';
import { copilotKeys, copilotText } from '../src/premium-copilot/copilot.i18n';
import { premiumAssistantUiMessages } from '../src/premium-voice-shell/premium-assistant-ui.i18n';
import { premiumConversationMessages } from '../src/premium-voice-shell/premium-conversation.i18n';
import { premiumVoiceShellMessages } from '../src/premium-voice-shell/premium-voice-shell.i18n';
import { roadControlCopy } from '../src/premium-situation-router/road-control.i18n';
import { requiredDocumentCopy } from '../src/premium-situation-router/required-document.i18n';
import { fieldBatchCopy } from '../src/premium-situation-router/field-batch.i18n';
import { preDepartureCopy, preDepartureLanguages } from '../src/pre-departure/pre-departure.i18n';
import { afterDepartureCopy, afterDepartureLanguages } from '../src/poc02-after-departure/after-departure.i18n';
import { afterDepartureOperationalEnglish } from '../src/poc02-after-departure/after-departure.operational-i18n';
import { finalLanguageOperationalDictionary } from '../src/i18n/final-language-operational.dictionary';
import { emailTemplates } from '../src/emailTemplates';
import { maintenanceEnglishSource } from '../src/maintenance-department';
import { supportedTranslationLanguages } from '../../api/src/translation/dto/translation-languages';
import { t } from '../src/i18n/app-i18n';
import { renderPremiumUserDashboard } from '../src/premium-governance/premium-governance.view';
import { renderCarMoverLanding } from '../src/car-mover/car-mover.landing';
import { renderPremiumAccessView } from '../src/premium-access/premium-access.view';

const expectedLanguages = ['ro','de','en','fr','nl','ru','pl','tr','sq','it','es','sv'] as const;
const targets = ['it','es','sv'] as const;
const technicalIdenticalValues = new Set([
  'AGM PREMIUM','AGM BASIC','A.G.M.','AG-011-009','AG-011-011','AG-011-010','AG-017','OK','ERROR',
  'Vite','TypeScript','Tesseract.js','Privacy','E-mail','Internet','Backend','MailMaster','WhatsApp',
  'No','Probable','Mentor','Atlas','Inspector','Legal','Manual','Formal','Transport','Journal','Vision',
  'Start','Premium','Version','Support','AI Copilot','System','Integration','PWA / Android','Trend','Atlas (Codex)',
  'RO ↔ DE Specialist','RO ↔ EN Specialist','DE ↔ EN Specialist','Turn Command Center – Operations',
  'atlas','inspector','turn','chronicler','librarian','🧭','🔎','📡','📚','📖',
  'Turn Command Center','AGM Chronicler','Linguistic Librarian','Status','Problem','Situation','AGM Cockpit',
]);
const wrongLanguage = /\b(back|save|close|loading|settings|password|driver|vehicle|warning|please|select|ready|ladungssicherung|zurück|speichern|abbrechen|fahrzeug|fahrer|dokumente|bestätigen|înapoi|salvează|anulează|confirmă|vehiculul|șoferul|parolă|eroare)\b/i;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function placeholders(value: string) {
  return [...value.matchAll(/\{+[a-zA-Z0-9_]+\}+/g)].map((match) => match[0]).sort();
}

function flatten(value: unknown, path = '', result: Record<string,string> = {}) {
  if (typeof value === 'string') result[path] = value;
  else if (Array.isArray(value)) value.forEach((item,index) => flatten(item, `${path}.${index}`, result));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key,item]) => flatten(item, path ? `${path}.${key}` : key, result));
  return result;
}

function assertCatalog(name: string, english: Record<string,string>, translated: Record<string,string>) {
  const englishKeys = Object.keys(english).sort();
  const translatedKeys = Object.keys(translated).sort();
  assert(JSON.stringify(translatedKeys) === JSON.stringify(englishKeys), `${name}: missing or extra keys`);
  for (const key of englishKeys) {
    const value = translated[key];
    assert(value?.trim(), `${name}.${key}: empty value`);
    assert(!value.includes('__AGM_TOKEN_'), `${name}.${key}: unresolved protected token`);
    assert(JSON.stringify(placeholders(value)) === JSON.stringify(placeholders(english[key])), `${name}.${key}: placeholder mismatch`);
    const prose = value.replace(/\{+[a-zA-Z0-9_]+\}+/g, '');
    assert(!wrongLanguage.test(prose), `${name}.${key}: wrong-language marker in ${JSON.stringify(value)}`);
    if (value === english[key]) assert(technicalIdenticalValues.has(value), `${name}.${key}: uncontrolled English fallback ${JSON.stringify(value)}`);
  }
}

assert(JSON.stringify(basicLanguageCodes) === JSON.stringify(expectedLanguages), 'central language registry is not the planned 12-language set');
assert(maximumBasicLanguageCapacity === 12, 'language capacity must be 12');
assert(JSON.stringify(supportedTranslationLanguages) === JSON.stringify(expectedLanguages), 'API translation language contract is out of sync');
for (const language of targets) {
  assert(basicLanguageRegistry[language].speechLocale && basicLanguageRegistry[language].ocrCode, `${language}: speech/OCR metadata missing`);
}
for (const catalog of i18nCatalogRegistry) {
  assert(JSON.stringify(catalog.languages) === JSON.stringify(expectedLanguages), `${catalog.id}: registry is not 12-language complete`);
}

const englishApp = appI18nDictionary.en! as Record<string,string>;
assert(Object.keys(englishApp).length === 1155, `canonical app key count changed: ${Object.keys(englishApp).length}`);
for (const language of targets) assertCatalog(`app.${language}`, englishApp, appI18nDictionary[language]! as Record<string,string>);

const canonicalOperational = {
  preDeparture: preDepartureCopy.en,
  afterDeparture: afterDepartureCopy.en,
  afterDepartureOperational: afterDepartureOperationalEnglish,
  emailTemplates: Object.fromEntries(emailTemplates.map((item) => [item.id,item.translations.en])),
  maintenance: maintenanceEnglishSource,
};
const operationalEnglish = flatten(canonicalOperational);
assert(Object.keys(operationalEnglish).length === 308, `canonical operational leaf count changed: ${Object.keys(operationalEnglish).length}`);
for (const language of targets) {
  const translated = flatten(finalLanguageOperationalDictionary[language]);
  assertCatalog(`operational.${language}`, operationalEnglish, translated);
}

assert(JSON.stringify(preDepartureLanguages) === JSON.stringify(expectedLanguages), 'Pre-departure languages are incomplete');
assert(JSON.stringify(afterDepartureLanguages) === JSON.stringify(expectedLanguages), 'After-departure languages are incomplete');
for (const language of targets) {
  assert(Object.keys(appI18nDictionary[language]!).length === 1155, `${language}: app key count mismatch`);
  assert(carMoverI18nKeys.every((key) => carMoverText(language,key)?.trim()), `${language}: Car Mover key missing`);
  assert(capabilityTextKeys.every((key) => capabilityText(language,key)?.trim()), `${language}: capability key missing`);
  assert(copilotKeys.every((key) => copilotText(language,key)?.trim()), `${language}: Copilot key missing`);
  for (const surface of [premiumAssistantUiMessages, premiumConversationMessages, premiumVoiceShellMessages, roadControlCopy, requiredDocumentCopy, fieldBatchCopy]) {
    assert(Object.keys(flatten(surface[language])).length === Object.keys(flatten(surface.en)).length, `${language}: direct Premium catalog parity failed`);
  }
  assert(emailTemplates.every((item) => item.translations[language].subject.trim() && item.translations[language].message.trim()), `${language}: email template missing`);
  const premium = renderPremiumUserDashboard((key) => t(language,key), (value) => value);
  assert(premium.includes(t(language,'premium.title')), `${language}: Premium title is not bound to i18n`);
  assert(premium.includes(t(language,'premium.module.beforeDeparture.title')), `${language}: Premium Before Departure card is not localized`);
  assert(premium.includes(t(language,'premium.module.afterDeparture.title')), `${language}: Premium After Departure card is not localized`);
  assert(!/Centru Premium|Spațiul utilizatorului|Vorbește cu AGM/.test(premium), `${language}: Romanian Premium dashboard fallback`);
  const carMover = renderCarMoverLanding(language);
  assert(carMover !== renderCarMoverLanding('en'), `${language}: Car Mover landing fell back to English`);
  const access = renderPremiumAccessView(language, (value) => value);
  assert(access !== renderPremiumAccessView('en', (value) => value), `${language}: Premium access view fell back to English`);
}

const directPremiumKeysPerLanguage = capabilityTextKeys.length + copilotKeys.length
  + Object.keys(flatten(premiumAssistantUiMessages.en)).length
  + Object.keys(flatten(premiumConversationMessages.en)).length
  + Object.keys(flatten(premiumVoiceShellMessages.en)).length
  + Object.keys(flatten(roadControlCopy.en)).length
  + Object.keys(flatten(requiredDocumentCopy.en)).length
  + Object.keys(flatten(fieldBatchCopy.en)).length;
assert(directPremiumKeysPerLanguage === 199, `direct Premium key count changed: ${directPremiumKeysPerLanguage}`);

console.log(JSON.stringify({
  status:'PASS', languages:[...targets], appKeysPerLanguage:1155, operationalLeavesPerLanguage:308,
  carMoverKeysPerLanguage:carMoverI18nKeys.length, directPremiumKeysPerLanguage,
  totalValidatedPerLanguage:1155+308+carMoverI18nKeys.length+directPremiumKeysPerLanguage,
  missingKeys:0, wrongFallbacks:0, unresolvedTokens:0,
}, null, 2));
