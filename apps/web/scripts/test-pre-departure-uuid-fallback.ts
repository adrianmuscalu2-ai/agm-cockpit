import assert from 'node:assert/strict';

import { createPreDepartureUuid } from '../src/pre-departure/pre-departure.uuid';
import { sha256Hex } from '../src/pre-departure/pre-departure.sha256';

const originalCrypto = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: {
    getRandomValues(bytes: Uint8Array) {
      bytes.forEach((_, index) => { bytes[index] = index + 1; });
      return bytes;
    },
  },
});

const uuid = createPreDepartureUuid();
assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(uuid, '01020304-0506-4708-890a-0b0c0d0e0f10');
assert.equal(
  await sha256Hex('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
);

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
console.log('Pre-departure UUID fallback: PASS');
