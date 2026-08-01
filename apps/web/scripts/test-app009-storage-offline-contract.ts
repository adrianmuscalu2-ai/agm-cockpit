import assert from 'node:assert/strict';

import { app009StorageRegistry } from '../src/storage/storage-registry';

assert.equal(app009StorageRegistry.length, 22);
assert.equal(new Set(app009StorageRegistry.map(({ id }) => id)).size, app009StorageRegistry.length);
assert.equal(new Set(app009StorageRegistry.map(({ key }) => key)).size, app009StorageRegistry.length);

for (const item of app009StorageRegistry) {
  assert.ok(item.id);
  assert.ok(item.key.startsWith('agm.'));
  assert.ok(item.owner);
  assert.equal(item.resetOwner, item.owner);
}

const credentials = app009StorageRegistry.filter(({ sensitivity }) => sensitivity === 'credential');
assert.deepEqual(credentials.map(({ id }) => id).sort(), ['adminSession', 'authAccessToken']);
assert.ok(credentials.every(({ offlineReadable }) => !offlineReadable));

for (const requiredOfflineContract of [
  'ocrHistory',
  'profile',
  'contacts',
  'messageLibrary',
  'preDepartureSession',
  'preDepartureOutbox',
  'premiumTripContext',
  'premiumOperationalOutbox',
]) {
  const contract = app009StorageRegistry.find(({ id }) => id === requiredOfflineContract);
  assert.ok(contract, `Missing storage contract: ${requiredOfflineContract}`);
  assert.equal(contract.offlineReadable, true, `${requiredOfflineContract} must remain available offline`);
}

assert.equal(
  app009StorageRegistry.find(({ id }) => id === 'adminSession')?.medium,
  'session',
);
assert.equal(
  app009StorageRegistry.find(({ id }) => id === 'authAccessToken')?.medium,
  'local-or-session',
);

console.log('APP-009 storage and offline governance contract: PASS');
