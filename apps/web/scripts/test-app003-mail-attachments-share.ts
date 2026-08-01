import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_MAIL_ATTACHMENTS,
  MAX_MAIL_ATTACHMENT_BYTES,
  MAX_MAIL_ATTACHMENTS_TOTAL_BYTES,
  validateMailAttachments,
} from '../src/mailmaster/mail-attachments';

assert.deepEqual(validateMailAttachments([{ size: 1024 }]), { ok: true });
assert.deepEqual(
  validateMailAttachments(Array.from({ length: MAX_MAIL_ATTACHMENTS + 1 }, () => ({ size: 1 }))),
  { ok: false, reason: 'too-many' },
);
assert.deepEqual(validateMailAttachments([{ size: MAX_MAIL_ATTACHMENT_BYTES + 1 }]), {
  ok: false,
  reason: 'file-too-large',
});
assert.deepEqual(validateMailAttachments([{ size: 0 }]), { ok: false, reason: 'empty-file' });
assert.deepEqual(
  validateMailAttachments([{ size: 7 * 1024 * 1024 }, { size: 7 * 1024 * 1024 }, { size: 7 * 1024 * 1024 }]),
  { ok: false, reason: 'total-too-large' },
);

const nativeEmail = readFileSync(new URL('../src/native-email.ts', import.meta.url), 'utf8');
const browserHandoff = readFileSync(
  new URL('../src/capabilities/handoff/browser-handoff.adapter.ts', import.meta.url),
  'utf8',
);
const handoffFacade = readFileSync(
  new URL('../src/capabilities/handoff/handoff.facade.ts', import.meta.url),
  'utf8',
);
const androidPlugin = readFileSync(
  new URL('../android/app/src/main/java/com/agm/cockpit/AgmEmailPlugin.java', import.meta.url),
  'utf8',
);
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

assert.match(nativeEmail, /handoff\.facade/);
assert.match(browserHandoff, /EMAIL_ATTACHMENTS_UNAVAILABLE/);
assert.match(handoffFacade, /openControlledShare/);
assert.match(androidPlugin, /Intent\.ACTION_SENDTO/);
assert.match(androidPlugin, /Intent\.ACTION_SEND_MULTIPLE/);
assert.match(androidPlugin, /FLAG_GRANT_READ_URI_PERMISSION/);
assert.match(androidPlugin, /FileProvider\.getUriForFile/);
assert.doesNotMatch(androidPlugin, /setPackage\(/);
assert.match(main, /pendingMailAction === 'whatsapp'/);
assert.match(main, /data-send="whatsapp"/);
assert.match(main, /mailAttachmentInput/);

console.log('APP-003 attachments and controlled share contract: PASS');
