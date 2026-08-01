import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sr05StorageRegistry,
  storageKeys,
} from '../src/storage/storage-registry';
import {
  createOcrHistoryRepository,
  type OcrHistoryItem,
} from '../src/storage/ocr-history.repository';
import { createTutorialRepository } from '../src/storage/tutorial.repository';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

assert.deepEqual(
  sr05StorageRegistry.map((entry) => ({
    id: entry.id,
    key: entry.key,
    schemaVersion: entry.schemaVersion,
    owner: entry.owner,
    retention: entry.retention,
    resetScopes: entry.resetScopes,
  })),
  [
    {
      id: 'ocrHistory',
      key: 'agm.ocr.history.v1',
      schemaVersion: 1,
      owner: 'ocr',
      retention: 'persistent-until-user-reset',
      resetScopes: ['ocr-history-delete', 'all-local-data'],
    },
    {
      id: 'tutorialCompletion',
      key: 'agm.tutorial.completed.v1',
      schemaVersion: 1,
      owner: 'guidance',
      retention: 'persistent-until-ocr-history-delete',
      resetScopes: ['ocr-history-delete'],
    },
    {
      id: 'emailTutorialCompletion',
      key: 'agm.tutorial.email.completed.v1',
      schemaVersion: 1,
      owner: 'guidance',
      retention: 'persistent-until-ocr-history-delete',
      resetScopes: ['ocr-history-delete'],
    },
    {
      id: 'roadmapInvitation',
      key: 'agm.roadmap.invitation.v1',
      schemaVersion: 1,
      owner: 'guidance',
      retention: 'persistent-until-ocr-history-delete',
      resetScopes: ['ocr-history-delete'],
    },
  ],
);
assert.equal(new Set(sr05StorageRegistry.map((entry) => entry.key)).size, 4);

const storage = createMemoryStorage();
const ocr = createOcrHistoryRepository(storage);
assert.deepEqual(ocr.read(), []);

storage.setItem(storageKeys.ocrHistory, '{bad json');
assert.deepEqual(ocr.read(), []);
storage.setItem(storageKeys.ocrHistory, JSON.stringify({ not: 'an array' }));
assert.deepEqual(ocr.read(), []);

const items = Array.from({ length: 10 }, (_, index): OcrHistoryItem => ({
  id: `ocr-${index}`,
  createdAt: `2026-07-29T08:00:${String(index).padStart(2, '0')}.000Z`,
  sourceLanguage: 'ro',
  targetLanguage: 'de',
  imageDataUrl: `data:image/jpeg;base64,${index}`,
  extractedText: `text-${index}`,
  translatedText: `translation-${index}`,
}));
ocr.save(items);
assert.equal(
  storage.getItem(storageKeys.ocrHistory),
  JSON.stringify(items.slice(0, 8)),
);
assert.deepEqual(createOcrHistoryRepository(storage).read(), items.slice(0, 8));

storage.setItem(
  storageKeys.ocrHistory,
  JSON.stringify([
    items[0],
    { ...items[1], id: '' },
    { ...items[2], createdAt: '' },
    { ...items[3], imageDataUrl: '' },
  ]),
);
assert.deepEqual(ocr.read(), [items[0]]);
ocr.clear();
assert.equal(storage.getItem(storageKeys.ocrHistory), null);

const tutorial = createTutorialRepository(storage);
assert.equal(tutorial.isTutorialCompleted(), false);
assert.equal(tutorial.isEmailTutorialCompleted(), false);
assert.equal(tutorial.isRoadmapInvitationDismissed(), false);

const tutorialAt = '2026-07-29T08:15:00.000Z';
const emailAt = '2026-07-29T08:16:00.000Z';
const roadmapAt = '2026-07-29T08:17:00.000Z';
assert.equal(tutorial.markTutorialCompleted(tutorialAt), tutorialAt);
assert.equal(tutorial.markEmailTutorialCompleted(emailAt), emailAt);
assert.equal(tutorial.dismissRoadmapInvitation(roadmapAt), roadmapAt);
assert.equal(storage.getItem(storageKeys.tutorialCompletion), tutorialAt);
assert.equal(storage.getItem(storageKeys.emailTutorialCompletion), emailAt);
assert.equal(storage.getItem(storageKeys.roadmapInvitation), roadmapAt);

const restartedTutorial = createTutorialRepository(storage);
assert.equal(restartedTutorial.isTutorialCompleted(), true);
assert.equal(restartedTutorial.isEmailTutorialCompleted(), true);
assert.equal(restartedTutorial.isRoadmapInvitationDismissed(), true);

storage.setItem(storageKeys.tutorialCompletion, 'malformed-but-nonempty');
assert.equal(restartedTutorial.isTutorialCompleted(), true);

restartedTutorial.clearForOcrHistoryDeletion();
assert.equal(storage.getItem(storageKeys.tutorialCompletion), null);
assert.equal(storage.getItem(storageKeys.emailTutorialCompletion), null);
assert.equal(storage.getItem(storageKeys.roadmapInvitation), null);

for (const removedLocalDefinition of [
  "const OCR_HISTORY_KEY = 'agm.ocr.history.v1';",
  "const TUTORIAL_COMPLETION_KEY = 'agm.tutorial.completed.v1';",
  "const EMAIL_TUTORIAL_COMPLETION_KEY = 'agm.tutorial.email.completed.v1';",
  "const ROADMAP_INVITATION_KEY = 'agm.roadmap.invitation.v1';",
  'function readTutorialCompletion(',
  'function readEmailTutorialCompletion(',
  'function readOcrHistory(',
  'function saveOcrHistory(',
]) {
  assert.ok(!main.includes(removedLocalDefinition), `Local storage boundary remains: ${removedLocalDefinition}`);
}

for (const protectedStorageBoundary of [
  'function readLegalAcceptance(storage: Storage)',
  'saveProfile(window.localStorage, state.profile)',
  'saveContacts(window.localStorage, state.contacts)',
  'saveMessageLibraryPreferences(window.localStorage, {',
  'saveIncidentJournal(window.localStorage, state.incidents)',
]) {
  assert.ok(main.includes(protectedStorageBoundary), `Out-of-scope storage moved: ${protectedStorageBoundary}`);
}

const deleteOcrHistoryBlock = between(
  main,
  'function deleteOcrHistoryData()',
  '\nfunction deletePreferenceData()',
);
assert.ok(deleteOcrHistoryBlock.includes('ocrHistoryRepository.clear();'));
assert.ok(
  deleteOcrHistoryBlock.includes(
    'tutorialRepository.clearForOcrHistoryDeletion();',
  ),
);

const resetAllBlock = between(
  main,
  'function resetAllLocalData()',
  '\nfunction ensureLegalAcceptanceForExternalProcessing()',
);
assert.ok(resetAllBlock.includes('ocrHistoryRepository.clear();'));
assert.ok(!resetAllBlock.includes('tutorialRepository.'));

console.log('SR-05 storage registry and repository parity: PASS');

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function between(value: string, startMarker: string, endMarker: string) {
  const start = value.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = value.indexOf(endMarker, start);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return value.slice(start, end);
}
