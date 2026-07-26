import assert from 'node:assert/strict';

import { mailTranslationAllowsSend } from '../src/mailmaster/mail-translation.guard';

assert.equal(mailTranslationAllowsSend(false, 'not-requested'), true);
assert.equal(mailTranslationAllowsSend(false, 'failed'), true);
assert.equal(mailTranslationAllowsSend(true, 'pending'), false);
assert.equal(mailTranslationAllowsSend(true, 'failed'), false);
assert.equal(mailTranslationAllowsSend(true, 'succeeded'), true);

console.log('Mail translation send guard: PASS');
