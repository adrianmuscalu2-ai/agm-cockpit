import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const storageRegistry = readFileSync(
  new URL('../src/storage/storage-registry.ts', import.meta.url),
  'utf8',
);
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const beforeDeparture = readFileSync(new URL('../before-departure.html', import.meta.url), 'utf8');
const afterDeparture = readFileSync(new URL('../after-departure.html', import.meta.url), 'utf8');

const expectedStateFields = [
  'view', 'profile', 'contacts', 'contactManagerOpen', 'contactSearch',
  'contactEditingId', 'contactDraft', 'contactErrors', 'recipient', 'subject',
  'message', 'translatorText', 'translatorResult', 'translatorInternetStatus',
  'translatorAiStatus', 'translatorServiceStatus', 'ocrImageDataUrl',
  'ocrExtractedText', 'ocrConfidence', 'ocrHistory', 'isOcrProcessing',
  'correctorText', 'correctorResult', 'correctorMode', 'correctorSourceModule',
  'isListening', 'voiceInputState', 'voicePlaybackState', 'adminSession',
  'adminAccessVerified', 'adminChangePinOpen', 'adminMenuOpen',
  'adminReportActive', 'adminReportModule', 'lastTechnicalError',
  'translatorEnabled', 'mailTranslationState', 'useProfileDetails',
  'signatureEditorOpen', 'signaturePadOpen', 'mailReviewOpen',
  'mailSecurityMessages', 'emailTone', 'emailComposeMode',
  'selectedEmailTemplateId', 'messageLibraryCategory', 'messageLibrarySearch',
  'messageLibraryFavorites', 'messageLibraryRecent', 'messageTemplateVariables',
  'incidents', 'incidentFilters', 'legalAcceptanceAccepted', 'tutorialOpen',
  'tutorialStep', 'tutorialDontShowAgain', 'tutorialOpenedFromHelp',
  'contextualHint', 'emailTutorialOpen', 'emailTutorialStep',
  'emailTutorialOpenedFromHelp', 'roadmapInvitationOpen', 'targetLanguage',
  'translatorTargetLanguage', 'status',
] as const;

const stateBlock = between(
  main,
  'const state = attachMailLegacyFacade(attachTranslatorLegacyFacade(attachContactsLegacyFacade(attachOcrLegacyFacade(attachIncidentsLegacyFacade({',
  '\n}, incidentsState), ocrState), contactsState), translatorState), mailState);',
);
const actualStateFields = [...stateBlock.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)]
  .map((match) => match[1]);
actualStateFields.push(
  'incidents', 'incidentFilters',
  'ocrImageDataUrl', 'ocrExtractedText', 'ocrConfidence', 'ocrHistory',
  'isOcrProcessing',
  'contacts', 'contactManagerOpen', 'contactSearch', 'contactEditingId',
  'contactDraft', 'contactErrors',
  'translatorText', 'translatorResult', 'translatorInternetStatus',
  'translatorAiStatus', 'translatorServiceStatus', 'translatorTargetLanguage',
  'recipient', 'subject', 'message', 'translatorEnabled', 'mailTranslationState',
  'signatureEditorOpen', 'signaturePadOpen', 'mailReviewOpen', 'mailSecurityMessages',
  'emailTone', 'emailComposeMode', 'selectedEmailTemplateId', 'messageLibraryCategory',
  'messageLibrarySearch', 'messageLibraryFavorites', 'messageLibraryRecent',
  'messageTemplateVariables',
);

assert.deepEqual(actualStateFields.sort(), [...expectedStateFields].sort());
assert.equal(actualStateFields.length, 65);

for (const marker of [
  'function renderCurrentView()',
  'function bindTranslator()',
  'function bindEmailAssistant()',
  'function bindContactManager()',
  'function bindIncidentJournal()',
  'async function startVoiceInput()',
  'async function processOcrImage(file: File)',
  'function registerServiceWorker()',
]) {
  assert.ok(main.includes(marker), `Missing current behavior marker: ${marker}`);
}

assert.ok(index.includes('src="/src/main.ts"'));
assert.ok(beforeDeparture.includes('src="/src/pre-departure/pre-departure.entry.ts"'));
assert.ok(afterDeparture.includes('src="/src/poc02-after-departure/after-departure.entry.ts"'));

for (const key of [
  'agm.ocr.history.v1',
  'agm.admin.session',
  'agm.tutorial.completed.v1',
  'agm.tutorial.email.completed.v1',
  'agm.roadmap.invitation.v1',
]) {
  assert.ok(
    `${main}\n${storageRegistry}`.includes(key),
    `Missing storage behavior marker: ${key}`,
  );
}

console.log('MC-3A main.ts characterization: PASS');

function between(value: string, startMarker: string, endMarker: string) {
  const start = value.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = value.indexOf(endMarker, start);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return value.slice(start, end);
}
