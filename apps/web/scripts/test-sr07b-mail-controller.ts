import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMailController, type MailControllerState } from '../src/mailmaster/mail.controller';

const state: MailControllerState = {
  recipient: 'user@example.com', subject: 'Test', message: 'Body',
  translatorEnabled: false, mailTranslationState: 'not-requested',
  mailReviewOpen: false, mailSecurityMessages: [], status: '',
};
let renders = 0;
const controller = createMailController({
  state, render: () => { renders += 1; },
  currentDraft: () => ({ recipient: state.recipient, subject: state.subject, message: state.message, tone: 'business' }),
  message: (key) => key, localizeSecurity: (message) => message,
});
controller.prepareSend();
assert.equal(state.mailReviewOpen, true);
state.translatorEnabled = true;
state.mailTranslationState = 'pending';
controller.prepareSend();
assert.equal(state.mailReviewOpen, false);
assert.equal(state.status, 'mail.status.translationRequiredSendBlocked');
state.mailTranslationState = 'succeeded';
state.recipient = '';
controller.prepareSend();
assert.equal(state.mailSecurityMessages[0], 'mail.security.missingRecipient');
controller.clear();
assert.equal(state.message, '');
assert.equal(state.mailTranslationState, 'pending');
controller.enableTranslation();
assert.equal(state.translatorEnabled, true);
assert.ok(renders >= 5);
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(main, /createMailController\(\{/);
assert.match(main, /mailController\.prepareSend\(\)/);
assert.match(main, /mailController\.clear\(\)/);
assert.match(main, /mailController\.enableTranslation\(\)/);
console.log('SR-07B Mail controller characterization: PASS');
