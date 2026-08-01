import assert from 'node:assert/strict';

import {
  defaultProfile,
  maximumDrawnSignatureLength,
  profileLanguageKey,
  profileStorageKey,
  readProfile,
  saveProfile,
  type ProfileStorage,
} from '../src/profileSettings';

class MemoryStorage implements ProfileStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const defaultsStorage = new MemoryStorage();
assert.deepEqual(readProfile(defaultsStorage), defaultProfile());

const legacyStorage = new MemoryStorage();
legacyStorage.setItem(profileLanguageKey, 'de');
assert.equal(readProfile(legacyStorage).preferredLanguage, 'de');

const corruptStorage = new MemoryStorage();
corruptStorage.setItem(profileStorageKey, '{invalid');
corruptStorage.setItem(profileLanguageKey, 'en');
assert.equal(readProfile(corruptStorage).preferredLanguage, 'en');

const validSignature = 'data:image/png;base64,iVBORw0KGgo=';
const normalizedStorage = new MemoryStorage();
const normalized = saveProfile(normalizedStorage, {
  displayName: '  Adrian Muscalu  ',
  phone: '  +40 123  ',
  email: '  driver@example.com  ',
  company: '  AGM  ',
  preferredLanguage: 'ro',
  defaultSignature: '  Cu respect  ',
  drawnSignatureDataUrl: validSignature,
});
assert.equal(normalized.displayName, 'Adrian Muscalu');
assert.equal(normalized.email, 'driver@example.com');
assert.equal(normalized.drawnSignatureDataUrl, validSignature);
assert.deepEqual(readProfile(normalizedStorage), normalized);

normalizedStorage.setItem(
  profileStorageKey,
  JSON.stringify({
    ...defaultProfile(),
    drawnSignatureDataUrl: 'https://tracking.invalid/signature.png',
  }),
);
assert.equal(readProfile(normalizedStorage).drawnSignatureDataUrl, '');

normalizedStorage.setItem(
  profileStorageKey,
  JSON.stringify({
    ...defaultProfile(),
    drawnSignatureDataUrl: `data:image/png;base64,${'a'.repeat(maximumDrawnSignatureLength)}`,
  }),
);
assert.equal(readProfile(normalizedStorage).drawnSignatureDataUrl, '');

console.log('APP-007 driver profile contract: PASS');
