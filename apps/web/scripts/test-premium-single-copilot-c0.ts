import assert from 'node:assert/strict';
import { basicLanguageCodes } from '../src/language-registry';
import { copilotCapabilities, PREMIUM_COPILOT_FLAG, copilotEnabled, routeCopilotIntent } from '../src/premium-copilot/copilot.contract';
import { copilotKeys, copilotText } from '../src/premium-copilot/copilot.i18n';
import { renderCopilot } from '../src/premium-copilot/copilot.view';
import { readFileSync } from 'node:fs';

for (const language of basicLanguageCodes) {
  for (const key of copilotKeys) assert.ok(copilotText(language, key).trim(), `${language}:${key}`);
  const html = renderCopilot(language, value => value);
  for (const marker of ['data-assistant-start','data-assistant-transcript','data-copilot-route','data-copilot-camera','data-assistant-replay','data-copilot-safety']) assert.match(html, new RegExp(marker));
  assert.doesNotMatch(html, /HUB-0|foundation|Înainte de Plecare|După Plecare/);
}
assert.equal(routeCopilotIntent('Mi s-a aprins martorul de frână').intent, 'DASHBOARD_WARNING');
assert.equal(routeCopilotIntent('Am un accident și este o persoană rănită').safetyGate, true);
assert.equal(routeCopilotIntent('Verifică documentul acesta').intent, 'DOCUMENT');
assert.equal(routeCopilotIntent('Sună service-ul').executionAllowed, false);
assert.equal(routeCopilotIntent('Trimite dispecerului că întârzii').executionAllowed, false);
assert.ok(copilotCapabilities.filter(capability => capability.enabledInC0).every(capability => capability.authority !== 'DEVICE_HANDOFF'));
assert.equal(copilotEnabled({ getItem: key => key === PREMIUM_COPILOT_FLAG ? 'true' : null }), true);
assert.equal(copilotEnabled({ getItem: () => null }), true);
assert.equal(copilotEnabled({ getItem: () => 'false' }), false);
const assistantRuntime = readFileSync(new URL('../src/premium-voice-shell/premium-assistant.runtime.ts', import.meta.url), 'utf8');
assert.match(assistantRuntime, /\[data-premium-assistant\], \[data-premium-copilot\]/, 'Copilot microphone must bind the validated auto-stop voice runtime');
console.log('Premium Single Copilot C0 contracts/i18n 9/9/safety/authority/rollback: PASS');
