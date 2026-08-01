import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { platformCapabilityRegistry } from '../src/capabilities/capability-registry';
import { handoffCapabilityMatrix } from '../src/capabilities/handoff/handoff.capability';
import { selectHandoffPort } from '../src/capabilities/handoff/handoff.facade';
import type { HandoffPort } from '../src/capabilities/handoff/handoff.port';

assert.equal(platformCapabilityRegistry.diagnostics.owner, 'APP-015');
assert.equal(platformCapabilityRegistry.handoff.boundary, 'ported');
assert.equal(platformCapabilityRegistry.clipboard.boundary, 'helper');
assert.equal(platformCapabilityRegistry.audio.boundary, 'legacy-facade');
assert.equal(handoffCapabilityMatrix[0].emailAttachments, false);
assert.equal(handoffCapabilityMatrix[1].emailAttachments, true);
assert.deepEqual(handoffCapabilityMatrix.flatMap((entry) => entry.permissions), []);

const browser: HandoffPort = {
  platform: 'browser',
  composeEmail: async () => undefined,
  share: async () => undefined,
};
const android: HandoffPort = {
  platform: 'android',
  composeEmail: async () => undefined,
  share: async () => undefined,
};
assert.equal(selectHandoffPort(false, browser, android), browser);
assert.equal(selectHandoffPort(true, browser, android), android);

const compatibilityFacade = readFileSync(new URL('../src/native-email.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(compatibilityFacade, /handoff\.facade/);
assert.match(compatibilityFacade, /NativeMailAttachment/);
assert.match(main, /import\('\.\/native-email'\)/);

console.log('APP-015 platform capability registry and handoff boundary: PASS');
