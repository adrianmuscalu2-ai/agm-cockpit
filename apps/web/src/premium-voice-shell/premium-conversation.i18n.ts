import type { BasicLanguageCode } from '../language-registry';

export const premiumConversationMessageKeys = [
  'thinking', 'clarificationNeeded', 'continue', 'correctInput',
  'actionPrepared', 'confirmAction', 'rejectAction', 'actionConfirmed',
  'actionRejected', 'turnLimitReached',
] as const;
export type PremiumConversationMessageKey = (typeof premiumConversationMessageKeys)[number];
type Messages = Record<PremiumConversationMessageKey, string>;

export const premiumConversationMessages: Record<BasicLanguageCode, Messages> = {
  ro: { thinking:'Analizez solicitarea.', clarificationNeeded:'Am nevoie de o clarificare.', continue:'Continuă conversația', correctInput:'Corectează solicitarea', actionPrepared:'Acțiunea este pregătită pentru verificare.', confirmAction:'Confirmă acțiunea', rejectAction:'Respinge acțiunea', actionConfirmed:'Acțiune confirmată.', actionRejected:'Acțiune respinsă.', turnLimitReached:'Conversația a atins limita acestei sesiuni.' },
  de: { thinking:'Die Anfrage wird analysiert.', clarificationNeeded:'Ich benötige eine Klarstellung.', continue:'Gespräch fortsetzen', correctInput:'Anfrage korrigieren', actionPrepared:'Die Aktion ist zur Prüfung vorbereitet.', confirmAction:'Aktion bestätigen', rejectAction:'Aktion ablehnen', actionConfirmed:'Aktion bestätigt.', actionRejected:'Aktion abgelehnt.', turnLimitReached:'Das Gespräch hat das Limit dieser Sitzung erreicht.' },
  en: { thinking:'Analyzing your request.', clarificationNeeded:'I need a clarification.', continue:'Continue conversation', correctInput:'Correct request', actionPrepared:'The action is ready for review.', confirmAction:'Confirm action', rejectAction:'Reject action', actionConfirmed:'Action confirmed.', actionRejected:'Action rejected.', turnLimitReached:'The conversation reached this session’s limit.' },
  fr: { thinking:"Analyse de votre demande.", clarificationNeeded:"J'ai besoin d'une précision.", continue:'Continuer la conversation', correctInput:'Corriger la demande', actionPrepared:"L'action est prête à être vérifiée.", confirmAction:"Confirmer l'action", rejectAction:"Refuser l'action", actionConfirmed:'Action confirmée.', actionRejected:'Action refusée.', turnLimitReached:'La conversation a atteint la limite de cette session.' },
  nl: { thinking:'Uw verzoek wordt geanalyseerd.', clarificationNeeded:'Ik heb een verduidelijking nodig.', continue:'Gesprek voortzetten', correctInput:'Verzoek corrigeren', actionPrepared:'De actie is klaar voor controle.', confirmAction:'Actie bevestigen', rejectAction:'Actie afwijzen', actionConfirmed:'Actie bevestigd.', actionRejected:'Actie afgewezen.', turnLimitReached:'Het gesprek heeft de limiet van deze sessie bereikt.' },
  ru: { thinking:'Запрос анализируется.', clarificationNeeded:'Требуется уточнение.', continue:'Продолжить разговор', correctInput:'Исправить запрос', actionPrepared:'Действие подготовлено для проверки.', confirmAction:'Подтвердить действие', rejectAction:'Отклонить действие', actionConfirmed:'Действие подтверждено.', actionRejected:'Действие отклонено.', turnLimitReached:'Достигнут лимит диалога для этой сессии.' },
  pl: { thinking:'Analizuję prośbę.', clarificationNeeded:'Potrzebuję wyjaśnienia.', continue:'Kontynuuj rozmowę', correctInput:'Popraw prośbę', actionPrepared:'Działanie jest gotowe do sprawdzenia.', confirmAction:'Potwierdź działanie', rejectAction:'Odrzuć działanie', actionConfirmed:'Działanie potwierdzone.', actionRejected:'Działanie odrzucone.', turnLimitReached:'Rozmowa osiągnęła limit tej sesji.' },
  tr: { thinking:'İstek analiz ediliyor.', clarificationNeeded:'Bir açıklamaya ihtiyacım var.', continue:'Konuşmaya devam et', correctInput:'İsteği düzelt', actionPrepared:'Eylem incelemeye hazır.', confirmAction:'Eylemi onayla', rejectAction:'Eylemi reddet', actionConfirmed:'Eylem onaylandı.', actionRejected:'Eylem reddedildi.', turnLimitReached:'Konuşma bu oturumun sınırına ulaştı.' },
  sq: { thinking:'Po analizohet kërkesa.', clarificationNeeded:'Më duhet një sqarim.', continue:'Vazhdo bisedën', correctInput:'Korrigjo kërkesën', actionPrepared:'Veprimi është gati për kontroll.', confirmAction:'Konfirmo veprimin', rejectAction:'Refuzo veprimin', actionConfirmed:'Veprimi u konfirmua.', actionRejected:'Veprimi u refuzua.', turnLimitReached:'Biseda arriti kufirin e këtij sesioni.' },
};

