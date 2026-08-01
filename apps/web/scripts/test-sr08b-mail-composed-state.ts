import assert from 'node:assert/strict';
import { attachMailLegacyFacade, createMailState, mailStateFields } from '../src/app-shell/mail-state.store';

const mail = createMailState({
  recipient: '', subject: '', message: '', translatorEnabled: false,
  mailTranslationState: 'not-requested', signatureEditorOpen: false,
  signaturePadOpen: false, mailReviewOpen: false, mailSecurityMessages: [],
  emailTone: 'business', emailComposeMode: 'manual', selectedEmailTemplateId: '',
  messageLibraryCategory: 'all', messageLibrarySearch: '',
  messageLibraryFavorites: [], messageLibraryRecent: [], messageTemplateVariables: {},
});
const legacy = attachMailLegacyFacade({ status: 'ready' }, mail);
legacy.recipient = 'legacy@example.com';
assert.equal(mail.recipient, 'legacy@example.com');
mail.subject = 'canonical';
assert.equal(legacy.subject, 'canonical');
for (const field of mailStateFields) {
  const descriptor = Object.getOwnPropertyDescriptor(legacy, field);
  assert.equal(typeof descriptor?.get, 'function');
  assert.equal(typeof descriptor?.set, 'function');
  assert.equal('value' in (descriptor ?? {}), false);
}
console.log('SR-08B Mail composed state and legacy facade: PASS');
