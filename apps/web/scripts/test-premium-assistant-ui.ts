import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basicLanguageCodes } from '../src/language-registry';
import { renderPremiumAssistantView } from '../src/premium-voice-shell/premium-assistant.view';
import { premiumAssistantUiMessages } from '../src/premium-voice-shell/premium-assistant-ui.i18n';

for(const language of basicLanguageCodes){
  const messages=premiumAssistantUiMessages[language];
  assert.ok(Object.values(messages).every((value)=>value.trim().length>0));
  const html=renderPremiumAssistantView(language,(value)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;'));
  assert.ok(html.includes(`data-language="${language}"`));
  assert.ok(html.includes('data-assistant-transcript'));
  assert.ok(html.includes('data-assistant-confirm'));
  assert.ok(html.includes('data-assistant-response'));
  assert.ok(html.includes('data-assistant-history'));
  assert.ok(html.includes(messages.title));
}
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
assert.match(css,/\.premium-assistant-view \.premium-module\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(css,/\.premium-assistant-view \[hidden\]\s*\{\s*display:\s*none !important/);
assert.match(css,/\[data-assistant-history\] li\[data-role="assistant"\]/);
const runtime=readFileSync(new URL('../src/premium-voice-shell/premium-assistant.runtime.ts',import.meta.url),'utf8');
assert.match(runtime,/agm\.premium\.assistant\.history\.v1/);
assert.match(runtime,/while\(history\.length>20\)history\.shift\(\)/);
assert.match(runtime,/sessionStorage\.setItem/);
console.log('Premium assistant Android-first UI render/i18n 9/9 PASS');
