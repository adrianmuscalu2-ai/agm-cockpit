import { evaluateMailDraftSecurity } from '../mail-security/mail-security.policy';
import { mailTranslationAllowsSend, type MailTranslationState } from './mail-translation.guard';
import type { MailDraft } from './mailmaster.types';
import type { MailState } from '../app-shell/app-state.contract';

export type MailControllerState = {
  recipient: string;
  subject: string;
  message: string;
  translatorEnabled: boolean;
  mailTranslationState: MailTranslationState;
  mailReviewOpen: boolean;
  mailSecurityMessages: string[];
  status: string;
};

export function createMailController(dependencies: {
  state: MailControllerState;
  mailState?: MailState;
  render(): void;
  currentDraft(): MailDraft;
  message(key: string): string;
  localizeSecurity(message: string): string;
}) {
  const { state } = dependencies;
  const mail = dependencies.mailState ?? state;
  return {
    prepareSend(): void {
      if (!mailTranslationAllowsSend(mail.translatorEnabled, mail.mailTranslationState)) {
        mail.mailReviewOpen = false;
        state.status = dependencies.message(
          mail.mailTranslationState === 'failed'
            ? 'mail.status.translationFailedSendBlocked'
            : 'mail.status.translationRequiredSendBlocked',
        );
        dependencies.render();
        return;
      }
      const security = evaluateMailDraftSecurity(dependencies.currentDraft());
      mail.mailSecurityMessages = security.messages;
      if (security.status === 'blocked') {
        mail.mailReviewOpen = false;
        state.status = dependencies.localizeSecurity(
          security.messages[0] ?? dependencies.message('mail.status.securityBlocked'),
        );
        dependencies.render();
        return;
      }
      mail.mailReviewOpen = true;
      state.status = dependencies.message('mail.securityCheck');
      dependencies.render();
    },
    clear(): void {
      mail.recipient = '';
      mail.subject = '';
      mail.message = '';
      mail.mailTranslationState = mail.translatorEnabled ? 'pending' : 'not-requested';
      mail.mailReviewOpen = false;
      mail.mailSecurityMessages = [];
      state.status = dependencies.message('status.fieldsCleared');
      dependencies.render();
    },
    enableTranslation(): void {
      mail.translatorEnabled = true;
      state.status = dependencies.message('translator.status.emailTranslatorEnabled');
      dependencies.render();
    },
  };
}
