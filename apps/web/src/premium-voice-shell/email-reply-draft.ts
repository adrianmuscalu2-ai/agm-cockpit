import type { ActiveDriverContext, AndroidActionResolution } from '../android-action-layer/android-action.contract';
import type { BasicLanguageCode } from '../language-registry';
import type { PremiumAssistantClientRequest } from './premium-assistant.client';

export function isReplyDraftRequest(text: string, hasMessageContext = false) {
  const value = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const explicitReply = /\b(?:raspunde|reply|antworte)\b.*\b(?:email|e-mail|mail|mesaj|message|nachricht)\b/.test(value);
  const contextualReply = /\b(?:raspunde(?:-i)?\s+ca|reply\s+that|antworte\s+dass)\b/.test(value)
    || /\b(?:redacteaza|pregateste|compune|scrie|draft|write|compose)\b.*\b(?:raspuns|reply|antwort)\b/.test(value);
  return explicitReply || (hasMessageContext && contextualReply);
}

export function replyDraftRequest(text: string, context: ActiveDriverContext, language: BasicLanguageCode, previousDraft?: string): PremiumAssistantClientRequest {
  return {
    productId: 'agm-cockpit', moduleId: 'premium-cockpit', language, task: 'DRAFT_REPLY',
    confirmedText: text.slice(0, 2000),
    history: [{ role: 'user', text: JSON.stringify({ originalMessage: (context.shareText || context.answerText).slice(0, 2500), subject: context.subject.slice(0, 200) }).slice(0, 4000) }, ...(previousDraft ? [{ role: 'assistant' as const, text: previousDraft.slice(0, 4000) }] : [])],
  };
}

// The model supplies text only. The recipient always comes from the verified
// Gmail context and cannot be changed by text inside the original message.
export function replyDraftResolution(context: ActiveDriverContext, text: string, now = Date.now()): AndroidActionResolution | null {
  if (context.expiresAtEpochMs <= now || !context.senderEmail || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(context.senderEmail) || !text.trim()) return null;
  return { contractVersion: 'android-action-resolution.v1', status: 'RESOLVED', action: 'EMAIL_DRAFT', source: 'ACTIVE_GMAIL_CONTEXT', reason: 'EMAIL_DRAFT_PREPARED_NO_SEND', confirmation: 'AGM_REQUIRED', payload: { expiresAtEpochMs: context.expiresAtEpochMs, value: context.senderEmail, subject: /^re:/i.test(context.subject) ? context.subject : `Re: ${context.subject}`, contextText: text.trim().slice(0, 4000) } };
}

export function isDraftRevision(text: string) {
  return /\b(?:mai scurt|mai lung|mai politicos|modifica|corecteaza|adauga|schimba|reformuleaza|shorter|longer|change|add|rewrite|kurzer|andere|erganze)\b/.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
}

export function requestsFreshEmail(text: string) {
  const value = text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return /\b(?:citeste|cauta|read|find|lies|suche)\b/.test(value) && /\b(?:email|e-mail|mail|gmail|mesaj|message|nachricht)\b/.test(value);
}
