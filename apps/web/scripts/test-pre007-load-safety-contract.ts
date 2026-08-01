import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  loadSafetyModule,
  validateLoadSafetyImageFile,
} from '../src/premium-load-safety/load-safety.module';
import {
  optionalFieldPhotoRoles,
  requiredFieldPhotoRoles,
} from '../src/premium-load-safety/field-test/field-test.state';

assert.equal(loadSafetyModule.id, 'ladungssicherung-assistant');
assert.equal(loadSafetyModule.storesImages, false);
assert.deepEqual(loadSafetyModule.accepts, ['image/jpeg', 'image/png', 'image/webp']);
assert.equal(loadSafetyModule.maxImageBytes, 8 * 1024 * 1024);

assert.deepEqual(validateLoadSafetyImageFile({ type: 'image/jpeg', size: 1024 }), { valid: true });
assert.deepEqual(validateLoadSafetyImageFile({ type: 'text/plain', size: 1024 }), {
  valid: false,
  reason: 'invalid',
});
assert.deepEqual(validateLoadSafetyImageFile({ type: 'image/png', size: loadSafetyModule.maxImageBytes + 1 }), {
  valid: false,
  reason: 'tooLarge',
});

assert.deepEqual(requiredFieldPhotoRoles, ['front-oblique', 'rear-oblique']);
assert.equal(new Set([...requiredFieldPhotoRoles, ...optionalFieldPhotoRoles]).size, 6);

const apiController = readFileSync(
  new URL('../../api/src/premium-load-safety/premium-load-safety.controller.ts', import.meta.url),
  'utf8',
);
assert.match(apiController, /photos\.length < 2/);
assert.match(apiController, /Two required JPEG, PNG, or WEBP lateral views are required/);
assert.doesNotMatch(apiController, /photos\.length < 4/);

const fieldController = readFileSync(
  new URL('../src/premium-load-safety/field-test/field-test.controller.ts', import.meta.url),
  'utf8',
);
assert.match(fieldController, /validateLoadSafetyImageFile\(file\)/);

console.log('PRE-007 Load Safety client/interface contract: PASS');
