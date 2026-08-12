import type { PreDepartureContext, PreDepartureState } from './pre-departure.types';

export type PreDepartureLanguage = 'ro' | 'de' | 'en' | 'fr' | 'nl' | 'ru' | 'pl' | 'tr' | 'sq';

export const preDepartureLanguages: readonly PreDepartureLanguage[] = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq'];

export const preDepartureLanguageLabels: Record<PreDepartureLanguage, string> = {
  ro: 'RO',
  de: 'DE',
  en: 'EN',
  fr: 'FR — Français',
  nl: 'NL — Nederlands',
  ru: 'RU — Русский',
  pl: 'PL — Polski',
  tr: 'TR — Türkçe',
  sq: 'SQ — Shqip',
};

const basePreDepartureCopy: Record<
  'ro' | 'de' | 'en',
  {
    eyebrow: string;
    title: string;
    intro: string;
    mode: string;
    status: string;
    stateLabel: string;
    contextsLabel: string;
    checksLabel: string;
    noChecks: string;
    start: string;
    resume: string;
    reset: string;
    confirmReady: string;
    reviewAssessment: string;
    close: string;
    save: string;
    restore: string;
    offline: string;
    resumeHint: string;
    languageHint: string;
    limits: string;
    flowTitle: string;
    flowHint: string;
    flowStepStart: string;
    flowStepContext: string;
    flowStepReview: string;
    flowStepConfirm: string;
    completedLabel: string;
    blockedLabel: string;
    confirmedLabel: string;
    closedLabel: string;
    localOnlyNote: string;
    resetQuestion: string;
    savedFeedback: string;
    restoredFeedback: string;
    missingSavedFeedback: string;
    invalidSavedFeedback: string;
    resetFeedback: string;
    issueDescriptionPrompt: string;
    issueCriticalPrompt: string;
    issueResolutionPrompt: string;
    issueResolvedFeedback: string;
    issueRegisterTitle: string;
    issueRegisterEmpty: string;
    issueResolveAction: string;
    issueCriticalLabel: string;
    issueWarningLabel: string;
    confirmationActorPrompt: string;
    confirmationStatement: string;
    exportReport: string;
    reportExportedFeedback: string;
    reportUnavailableFeedback: string;
    reviewTitle: string;
    reviewHint: string;
    reviewReady: string;
    reviewBlocked: string;
    progressLabel: string;
    automaticSummaryTitle: string;
    automaticSummaryHint: string;
    stepsTitle: string;
    stepsHint: string;
    continueToChecks: string;
    selectContextFeedback: string;
    contexts: Record<PreDepartureContext, string>;
    states: Record<PreDepartureState, string>;
    checks: Record<string, string>;
    actions: {
      confirmed: string;
      problem: string;
      na: string;
      edit: string;
    };
    summary: {
      contexts: string;
      checks: string;
      answers: string;
      problems: string;
      incomplete: string;
    };
  }
> = {
  ro: {
    eyebrow: 'ETAPA 6 · E6.4 / E6.5 / E6.6',
    title: 'Înainte de Plecare',
    intro: 'Flux local, accesibil și verificabil înaintea pornirii în cursă.',
    mode: 'Mod de lucru',
    status: 'Stare',
    stateLabel: 'Stare curentă',
    contextsLabel: 'Contexte selectate',
    checksLabel: 'Verificări aplicabile',
    noChecks: 'Nu există verificări aplicabile încă. Selectează cel puțin un context.',
    start: 'Începe evaluarea',
    resume: 'Reia sesiunea',
    reset: 'Resetează sesiunea',
    confirmReady: 'Confirmă pregătirea',
    reviewAssessment: 'Finalizează verificările',
    close: 'Închide sesiunea',
    save: 'Salvează local',
    restore: 'Restaurează local',
    offline: 'Modul browser este offline. Sesiunea continuă local, fără transmitere externă.',
    resumeHint: 'Pagina poate fi repornită și reluată local fără a pierde starea salvată.',
    languageHint: 'RO / DE / EN păstrează aceeași logică și aceleași stări.',
    limits: 'Limită E6.4–E6.6: niciun răspuns nu părăsește browserul sau dispozitivul.',
    flowTitle: 'Flux canonic',
    flowHint: 'Început local → selecție context → evaluare verificări → confirmare → închidere.',
    flowStepStart: 'Pornire',
    flowStepContext: 'Selectare context',
    flowStepReview: 'Evaluare',
    flowStepConfirm: 'Confirmare',
    completedLabel: 'Complet',
    blockedLabel: 'Blocat',
    confirmedLabel: 'Confirmat',
    closedLabel: 'Închis',
    localOnlyNote: 'Toate acțiunile și rezultatele sunt locale și nu transmite date către exterior.',
    resetQuestion: 'Resetezi sesiunea locală „Înainte de plecare”? Datele salvate local vor fi șterse.',
    savedFeedback: 'Sesiunea a fost salvată local.',
    restoredFeedback: 'Sesiunea a fost restaurată.',
    missingSavedFeedback: 'Nu există o sesiune locală salvată.',
    invalidSavedFeedback: 'Sesiunea salvată nu poate fi restaurată.',
    resetFeedback: 'Sesiunea a fost resetată.',
    issueDescriptionPrompt: 'Descrie problema identificată:',
    issueCriticalPrompt: 'Problema blochează plecarea? OK = critică, Anulare = avertizare.',
    issueResolutionPrompt: 'Descrie remedierea efectuată. Verificarea va trebui repetată:',
    issueResolvedFeedback: 'Problema a fost marcată rezolvată. Repetă verificarea asociată.',
    issueRegisterTitle: 'Registrul problemelor',
    issueRegisterEmpty: 'Nu există probleme înregistrate.',
    issueResolveAction: 'Marchează rezolvată',
    issueCriticalLabel: 'Critică — plecare blocată',
    issueWarningLabel: 'Avertizare',
    confirmationActorPrompt: 'Numele persoanei care confirmă verificarea:',
    confirmationStatement: 'Confirm că am verificat rezumatul și că nu există probleme deschise. Aceasta este o declarație operațională, nu o semnătură electronică calificată.',
    exportReport: 'Descarcă raportul',
    reportExportedFeedback: 'Raportul final verificabil a fost generat.',
    reportUnavailableFeedback: 'Raportul final nu poate fi generat înaintea confirmării complete.',
    reviewTitle: 'Rezumat înainte de confirmare',
    reviewHint: 'Verifică toate răspunsurile înainte de confirmarea pregătirii.',
    reviewReady: 'Toate verificările sunt completate. Poți confirma pregătirea.',
    reviewBlocked: 'Există probleme deschise. Rezolvă-le înainte de confirmare.',
    progressLabel: 'Progres verificări',
    automaticSummaryTitle: 'Rezumat automat',
    automaticSummaryHint: 'Indicatori informativi actualizați automat. Nu sunt butoane.',
    stepsTitle: 'Etapele verificării',
    stepsHint: 'Etapele se actualizează automat pe măsură ce completezi fluxul.',
    continueToChecks: 'Continuă la verificări',
    selectContextFeedback: 'Selectează cel puțin un context înainte de a continua.',
    contexts: {
      local: 'Transport local',
      'long-distance': 'Transport pe distanță lungă',
      adr: 'Context ADR',
      night: 'Condiții de noapte',
      'adverse-weather': 'Condiții dificile de vreme',
    },
    states: {
      NOT_STARTED: 'Neînceput',
      CONTEXT_SELECTION: 'Selectare context',
      IN_PROGRESS: 'În desfășurare',
      NEEDS_ATTENTION: 'Necesită atenție',
      BLOCKED: 'Blocat',
      READY_TO_CONFIRM: 'Pregătit pentru confirmare',
      CONFIRMED: 'Confirmat',
      CLOSED: 'Închis',
    },
    checks: {
      vehicle: 'Starea și siguranța vehiculului',
      driver: 'Aptitudinea și starea șoferului',
      documents: 'Documentele transportului',
      tachograph: 'Tahograf și timpi',
      cargo: 'Încărcătura și fixarea',
      route: 'Ruta și restricțiile',
      adr: 'Control ADR',
      weather: 'Condiții de noapte / vreme',
    },
    actions: {
      confirmed: 'Confirmat',
      problem: 'Problemă',
      na: 'Neaplicabil',
      edit: 'Editează',
    },
    summary: {
      contexts: 'Contexte',
      checks: 'Verificări',
      answers: 'Răspunsuri',
      problems: 'Probleme deschise',
      incomplete: 'Elemente incomplete',
    },
  },
  de: {
    eyebrow: 'STUFE 6 · E6.4 / E6.5 / E6.6',
    title: 'Vor der Abfahrt',
    intro: 'Lokaler, zugänglicher und überprüfbarer Ablauf vor dem Start der Fahrt.',
    mode: 'Arbeitsmodus',
    status: 'Status',
    stateLabel: 'Aktueller Status',
    contextsLabel: 'Gewählte Kontexte',
    checksLabel: 'Anwendbare Prüfungen',
    noChecks: 'Noch keine anwendbaren Prüfungen. Wähle mindestens einen Kontext.',
    start: 'Bewertung starten',
    resume: 'Sitzung fortsetzen',
    reset: 'Sitzung zurücksetzen',
    confirmReady: 'Bereitschaft bestätigen',
    reviewAssessment: 'Prüfungen abschließen',
    close: 'Sitzung schließen',
    save: 'Lokal speichern',
    restore: 'Lokal wiederherstellen',
    offline: 'Der Browser ist offline. Die Sitzung läuft lokal weiter, ohne externe Übertragung.',
    resumeHint: 'Die Seite kann lokal neu geladen und mit gespeichertem Zustand fortgesetzt werden.',
    languageHint: 'RO / DE / EN bleibt logisch und in den Zuständen gleich.',
    limits: 'Grenze E6.4–E6.6: keine Antwort verlässt Browser oder Gerät.',
    flowTitle: 'Kanonischer Ablauf',
    flowHint: 'Lokaler Start → Kontextwahl → Prüfung → Bestätigung → Abschluss.',
    flowStepStart: 'Start',
    flowStepContext: 'Kontextwahl',
    flowStepReview: 'Prüfung',
    flowStepConfirm: 'Bestätigung',
    completedLabel: 'Vollständig',
    blockedLabel: 'Blockiert',
    confirmedLabel: 'Bestätigt',
    closedLabel: 'Geschlossen',
    localOnlyNote: 'Alle Aktionen und Ergebnisse sind lokal und prüfbar.',
    resetQuestion: 'Lokale Sitzung „Vor der Abfahrt“ zurücksetzen? Lokal gespeicherte Daten werden gelöscht.',
    savedFeedback: 'Die Sitzung wurde lokal gespeichert.',
    restoredFeedback: 'Die Sitzung wurde wiederhergestellt.',
    missingSavedFeedback: 'Keine lokal gespeicherte Sitzung vorhanden.',
    invalidSavedFeedback: 'Die gespeicherte Sitzung kann nicht wiederhergestellt werden.',
    resetFeedback: 'Die Sitzung wurde zurückgesetzt.',
    issueDescriptionPrompt: 'Beschreibe das festgestellte Problem:',
    issueCriticalPrompt: 'Blockiert das Problem die Abfahrt? OK = kritisch, Abbrechen = Warnung.',
    issueResolutionPrompt: 'Beschreibe die Behebung. Die Prüfung muss wiederholt werden:',
    issueResolvedFeedback: 'Das Problem wurde als gelöst markiert. Wiederhole die zugehörige Prüfung.',
    issueRegisterTitle: 'Problemregister',
    issueRegisterEmpty: 'Keine Probleme erfasst.',
    issueResolveAction: 'Als gelöst markieren',
    issueCriticalLabel: 'Kritisch — Abfahrt blockiert',
    issueWarningLabel: 'Warnung',
    confirmationActorPrompt: 'Name der Person, die die Prüfung bestätigt:',
    confirmationStatement: 'Ich bestätige, dass ich die Zusammenfassung geprüft habe und keine offenen Probleme bestehen. Dies ist eine betriebliche Erklärung, keine qualifizierte elektronische Signatur.',
    exportReport: 'Bericht herunterladen',
    reportExportedFeedback: 'Der überprüfbare Abschlussbericht wurde erstellt.',
    reportUnavailableFeedback: 'Der Abschlussbericht kann vor der vollständigen Bestätigung nicht erstellt werden.',
    reviewTitle: 'Zusammenfassung vor der Bestätigung',
    reviewHint: 'Prüfe alle Antworten, bevor du die Bereitschaft bestätigst.',
    reviewReady: 'Alle Prüfungen sind abgeschlossen. Die Bereitschaft kann bestätigt werden.',
    reviewBlocked: 'Es gibt offene Probleme. Löse sie vor der Bestätigung.',
    progressLabel: 'Prüffortschritt',
    automaticSummaryTitle: 'Automatische Übersicht',
    automaticSummaryHint: 'Automatisch aktualisierte Informationsanzeigen. Keine Schaltflächen.',
    stepsTitle: 'Prüfschritte',
    stepsHint: 'Die Schritte werden während des Ablaufs automatisch aktualisiert.',
    continueToChecks: 'Weiter zu den Prüfungen',
    selectContextFeedback: 'Wähle mindestens einen Kontext, bevor du fortfährst.',
    contexts: {
      local: 'Lokaler Transport',
      'long-distance': 'Ferntransport',
      adr: 'ADR-Kontext',
      night: 'Nachtbedingungen',
      'adverse-weather': 'Schwierige Wetterbedingungen',
    },
    states: {
      NOT_STARTED: 'Nicht begonnen',
      CONTEXT_SELECTION: 'Kontextwahl',
      IN_PROGRESS: 'In Bearbeitung',
      NEEDS_ATTENTION: 'Erfordert Aufmerksamkeit',
      BLOCKED: 'Blockiert',
      READY_TO_CONFIRM: 'Bereit zur Bestätigung',
      CONFIRMED: 'Bestätigt',
      CLOSED: 'Geschlossen',
    },
    checks: {
      vehicle: 'Fahrzeugzustand und Sicherheit',
      driver: 'Eignung und Zustand des Fahrers',
      documents: 'Transportdokumente',
      tachograph: 'Tachograph und Zeiten',
      cargo: 'Ladung und Sicherung',
      route: 'Route und Einschränkungen',
      adr: 'ADR-Prüfung',
      weather: 'Nacht- / Wetterbedingungen',
    },
    actions: {
      confirmed: 'Bestätigt',
      problem: 'Problem',
      na: 'Nicht anwendbar',
      edit: 'Bearbeiten',
    },
    summary: {
      contexts: 'Kontexte',
      checks: 'Prüfungen',
      answers: 'Antworten',
      problems: 'Offene Probleme',
      incomplete: 'Unvollständige Elemente',
    },
  },
  en: {
    eyebrow: 'STAGE 6 · E6.4 / E6.5 / E6.6',
    title: 'Before Departure',
    intro: 'A local, accessible, and verifiable flow before the trip begins.',
    mode: 'Mode',
    status: 'Status',
    stateLabel: 'Current state',
    contextsLabel: 'Selected contexts',
    checksLabel: 'Applicable checks',
    noChecks: 'No checks are applicable yet. Select at least one context.',
    start: 'Start assessment',
    resume: 'Resume session',
    reset: 'Reset session',
    confirmReady: 'Confirm readiness',
    reviewAssessment: 'Complete checks',
    close: 'Close session',
    save: 'Save locally',
    restore: 'Restore locally',
    offline: 'Browser is offline. The session continues locally with no external transmission.',
    resumeHint: 'The page can be reloaded and resumed locally without losing the saved state.',
    languageHint: 'RO / DE / EN keeps the same logic and the same states.',
    limits: 'Limit E6.4–E6.6: no response leaves the browser or device.',
    flowTitle: 'Canonical flow',
    flowHint: 'Local start → context selection → review → confirmation → close.',
    flowStepStart: 'Start',
    flowStepContext: 'Context selection',
    flowStepReview: 'Review',
    flowStepConfirm: 'Confirmation',
    completedLabel: 'Complete',
    blockedLabel: 'Blocked',
    confirmedLabel: 'Confirmed',
    closedLabel: 'Closed',
    localOnlyNote: 'All actions and results are local and auditable.',
    resetQuestion: 'Reset the local “Before Departure” session? Locally saved data will be deleted.',
    savedFeedback: 'The session was saved locally.',
    restoredFeedback: 'The session was restored.',
    missingSavedFeedback: 'No locally saved session is available.',
    invalidSavedFeedback: 'The saved session cannot be restored.',
    resetFeedback: 'The session was reset.',
    issueDescriptionPrompt: 'Describe the identified problem:',
    issueCriticalPrompt: 'Does this problem block departure? OK = critical, Cancel = warning.',
    issueResolutionPrompt: 'Describe the remediation. The associated check must be repeated:',
    issueResolvedFeedback: 'The problem was resolved. Repeat the associated check.',
    issueRegisterTitle: 'Problem register',
    issueRegisterEmpty: 'No problems have been recorded.',
    issueResolveAction: 'Mark resolved',
    issueCriticalLabel: 'Critical — departure blocked',
    issueWarningLabel: 'Warning',
    confirmationActorPrompt: 'Name of the person confirming the assessment:',
    confirmationStatement: 'I confirm that I reviewed the summary and that no open problems remain. This is an operational declaration, not a qualified electronic signature.',
    exportReport: 'Download report',
    reportExportedFeedback: 'The verifiable final report was generated.',
    reportUnavailableFeedback: 'The final report cannot be generated before complete confirmation.',
    reviewTitle: 'Summary before confirmation',
    reviewHint: 'Review every answer before confirming readiness.',
    reviewReady: 'All checks are complete. You can confirm readiness.',
    reviewBlocked: 'There are open problems. Resolve them before confirmation.',
    progressLabel: 'Check progress',
    automaticSummaryTitle: 'Automatic summary',
    automaticSummaryHint: 'Informational indicators updated automatically. They are not buttons.',
    stepsTitle: 'Assessment steps',
    stepsHint: 'Steps update automatically as you complete the flow.',
    continueToChecks: 'Continue to checks',
    selectContextFeedback: 'Select at least one context before continuing.',
    contexts: {
      local: 'Local transport',
      'long-distance': 'Long-distance transport',
      adr: 'ADR context',
      night: 'Night conditions',
      'adverse-weather': 'Adverse weather',
    },
    states: {
      NOT_STARTED: 'Not started',
      CONTEXT_SELECTION: 'Context selection',
      IN_PROGRESS: 'In progress',
      NEEDS_ATTENTION: 'Needs attention',
      BLOCKED: 'Blocked',
      READY_TO_CONFIRM: 'Ready to confirm',
      CONFIRMED: 'Confirmed',
      CLOSED: 'Closed',
    },
    checks: {
      vehicle: 'Vehicle condition and safety',
      driver: 'Driver fitness and condition',
      documents: 'Transport documents',
      tachograph: 'Tachograph and timings',
      cargo: 'Cargo and securing',
      route: 'Route and restrictions',
      adr: 'ADR review',
      weather: 'Night / weather conditions',
    },
    actions: {
      confirmed: 'Confirmed',
      problem: 'Problem',
      na: 'Not applicable',
      edit: 'Edit',
    },
    summary: {
      contexts: 'Contexts',
      checks: 'Checks',
      answers: 'Answers',
      problems: 'Open problems',
      incomplete: 'Incomplete items',
    },
  },
};

type PreDepartureCopy = (typeof basePreDepartureCopy)['en'];

// These records intentionally contain every operational label shown by the flow.
// They are kept next to the state-machine vocabulary so language changes never
// alter or recreate the underlying session.
const additionalPreDepartureCopy: Record<Exclude<PreDepartureLanguage, 'ro' | 'de' | 'en'>, PreDepartureCopy> = {
  fr: { ...basePreDepartureCopy.en, title:'Avant le départ', intro:'Flux local, accessible et vérifiable avant le départ.', mode:'Langue', status:'État', stateLabel:'État actuel', contextsLabel:'Contextes sélectionnés', checksLabel:'Contrôles applicables', noChecks:'Aucun contrôle applicable. Sélectionnez au moins un contexte.', start:'Commencer l’évaluation', resume:'Reprendre la session', reset:'Réinitialiser la session', confirmReady:'Confirmer la préparation', reviewAssessment:'Terminer les contrôles', close:'Fermer la session', save:'Enregistrer localement', restore:'Restaurer localement', offline:'L’appareil est hors ligne. La session continue localement sans transmission externe.', languageHint:'Les 9 langues conservent la même logique et les mêmes états.', limits:'Aucune réponse ne quitte le navigateur ou l’appareil.', flowTitle:'Flux canonique', flowHint:'Démarrage local → choix du contexte → contrôles → confirmation → fermeture.', flowStepStart:'Démarrage', flowStepContext:'Choix du contexte', flowStepReview:'Contrôle', flowStepConfirm:'Confirmation', completedLabel:'Terminé', blockedLabel:'Bloqué', confirmedLabel:'Confirmé', closedLabel:'Fermé', localOnlyNote:'Toutes les actions et tous les résultats restent locaux.', continueToChecks:'Continuer vers les contrôles', selectContextFeedback:'Sélectionnez au moins un contexte.', progressLabel:'Progression', automaticSummaryTitle:'Résumé automatique', automaticSummaryHint:'Indicateurs informatifs mis à jour automatiquement.', stepsTitle:'Étapes du contrôle', stepsHint:'Les étapes se mettent à jour pendant le flux.', contexts:{local:'Transport local','long-distance':'Transport longue distance',adr:'Contexte ADR',night:'Conditions nocturnes','adverse-weather':'Conditions météorologiques difficiles'}, states:{NOT_STARTED:'Non commencé',CONTEXT_SELECTION:'Choix du contexte',IN_PROGRESS:'En cours',NEEDS_ATTENTION:'Attention requise',BLOCKED:'Bloqué',READY_TO_CONFIRM:'Prêt à confirmer',CONFIRMED:'Confirmé',CLOSED:'Fermé'}, checks:{vehicle:'État et sécurité du véhicule',driver:'Aptitude et état du conducteur',documents:'Documents de transport',tachograph:'Tachygraphe et temps',cargo:'Chargement et arrimage',route:'Itinéraire et restrictions',adr:'Contrôle ADR',weather:'Nuit / météo'}, actions:{confirmed:'Confirmé',problem:'Problème',na:'Sans objet',edit:'Modifier'}, summary:{contexts:'Contextes',checks:'Contrôles',answers:'Réponses',problems:'Problèmes ouverts',incomplete:'Éléments incomplets'} },
  nl: { ...basePreDepartureCopy.en, title:'Voor vertrek', intro:'Lokale, toegankelijke en controleerbare workflow vóór vertrek.', mode:'Taal', status:'Status', stateLabel:'Huidige status', contextsLabel:'Geselecteerde contexten', checksLabel:'Toepasselijke controles', noChecks:'Nog geen controles. Selecteer minstens één context.', start:'Beoordeling starten', resume:'Sessie hervatten', reset:'Sessie resetten', confirmReady:'Gereedheid bevestigen', reviewAssessment:'Controles voltooien', close:'Sessie sluiten', save:'Lokaal opslaan', restore:'Lokaal herstellen', offline:'Het apparaat is offline. De sessie blijft lokaal beschikbaar zonder verzending.', languageHint:'Alle 9 talen behouden dezelfde logica en status.', limits:'Geen antwoord verlaat de browser of het apparaat.', flowTitle:'Standaardproces', flowHint:'Lokale start → contextkeuze → controle → bevestiging → sluiten.', flowStepStart:'Start', flowStepContext:'Contextkeuze', flowStepReview:'Controle', flowStepConfirm:'Bevestiging', completedLabel:'Voltooid', blockedLabel:'Geblokkeerd', confirmedLabel:'Bevestigd', closedLabel:'Gesloten', localOnlyNote:'Alle acties en resultaten blijven lokaal.', continueToChecks:'Doorgaan naar controles', selectContextFeedback:'Selecteer minstens één context.', progressLabel:'Voortgang', automaticSummaryTitle:'Automatisch overzicht', automaticSummaryHint:'Informatieve indicatoren worden automatisch bijgewerkt.', stepsTitle:'Controlestappen', stepsHint:'De stappen worden tijdens het proces bijgewerkt.', contexts:{local:'Lokaal vervoer','long-distance':'Langeafstandstransport',adr:'ADR-context',night:'Nachtelijke omstandigheden','adverse-weather':'Moeilijke weersomstandigheden'}, states:{NOT_STARTED:'Niet gestart',CONTEXT_SELECTION:'Contextkeuze',IN_PROGRESS:'Bezig',NEEDS_ATTENTION:'Aandacht vereist',BLOCKED:'Geblokkeerd',READY_TO_CONFIRM:'Klaar voor bevestiging',CONFIRMED:'Bevestigd',CLOSED:'Gesloten'}, checks:{vehicle:'Voertuigconditie en veiligheid',driver:'Geschiktheid en toestand bestuurder',documents:'Transportdocumenten',tachograph:'Tachograaf en tijden',cargo:'Lading en zekering',route:'Route en beperkingen',adr:'ADR-controle',weather:'Nacht / weer'}, actions:{confirmed:'Bevestigd',problem:'Probleem',na:'Niet van toepassing',edit:'Bewerken'}, summary:{contexts:'Contexten',checks:'Controles',answers:'Antwoorden',problems:'Open problemen',incomplete:'Onvolledige items'} },
  ru: { ...basePreDepartureCopy.en, title:'Перед отправлением', intro:'Локальная, доступная и проверяемая процедура перед рейсом.', mode:'Язык', status:'Состояние', stateLabel:'Текущее состояние', contextsLabel:'Выбранные условия', checksLabel:'Применимые проверки', noChecks:'Проверок пока нет. Выберите хотя бы одно условие.', start:'Начать проверку', resume:'Продолжить сеанс', reset:'Сбросить сеанс', confirmReady:'Подтвердить готовность', reviewAssessment:'Завершить проверки', close:'Закрыть сеанс', save:'Сохранить локально', restore:'Восстановить локально', offline:'Устройство не в сети. Сеанс продолжается локально без передачи данных.', languageHint:'Все 9 языков сохраняют одинаковую логику и состояния.', limits:'Ответы не покидают браузер или устройство.', flowTitle:'Основной процесс', flowHint:'Локальный запуск → выбор условий → проверка → подтверждение → закрытие.', flowStepStart:'Запуск', flowStepContext:'Выбор условий', flowStepReview:'Проверка', flowStepConfirm:'Подтверждение', completedLabel:'Готово', blockedLabel:'Заблокировано', confirmedLabel:'Подтверждено', closedLabel:'Закрыто', localOnlyNote:'Все действия и результаты остаются на устройстве.', continueToChecks:'Перейти к проверкам', selectContextFeedback:'Выберите хотя бы одно условие.', progressLabel:'Ход проверки', automaticSummaryTitle:'Автоматическая сводка', automaticSummaryHint:'Информационные показатели обновляются автоматически.', stepsTitle:'Этапы проверки', stepsHint:'Этапы обновляются по мере выполнения.', contexts:{local:'Местная перевозка','long-distance':'Дальняя перевозка',adr:'Условия ADR',night:'Ночные условия','adverse-weather':'Сложные погодные условия'}, states:{NOT_STARTED:'Не начато',CONTEXT_SELECTION:'Выбор условий',IN_PROGRESS:'Выполняется',NEEDS_ATTENTION:'Требует внимания',BLOCKED:'Заблокировано',READY_TO_CONFIRM:'Готово к подтверждению',CONFIRMED:'Подтверждено',CLOSED:'Закрыто'}, checks:{vehicle:'Состояние и безопасность автомобиля',driver:'Готовность и состояние водителя',documents:'Транспортные документы',tachograph:'Тахограф и время',cargo:'Груз и крепление',route:'Маршрут и ограничения',adr:'Проверка ADR',weather:'Ночь / погода'}, actions:{confirmed:'Подтверждено',problem:'Проблема',na:'Не применимо',edit:'Изменить'}, summary:{contexts:'Условия',checks:'Проверки',answers:'Ответы',problems:'Открытые проблемы',incomplete:'Незавершённые пункты'} },
  pl: { ...basePreDepartureCopy.en, title:'Przed wyjazdem', intro:'Lokalny, dostępny i weryfikowalny proces przed rozpoczęciem trasy.', mode:'Język', status:'Stan', stateLabel:'Bieżący stan', contextsLabel:'Wybrane konteksty', checksLabel:'Właściwe kontrole', noChecks:'Brak kontroli. Wybierz co najmniej jeden kontekst.', start:'Rozpocznij ocenę', resume:'Wznów sesję', reset:'Resetuj sesję', confirmReady:'Potwierdź gotowość', reviewAssessment:'Zakończ kontrole', close:'Zamknij sesję', save:'Zapisz lokalnie', restore:'Przywróć lokalnie', offline:'Urządzenie jest offline. Sesja działa lokalnie bez transmisji.', languageHint:'Wszystkie 9 języków zachowuje tę samą logikę i stany.', limits:'Żadna odpowiedź nie opuszcza przeglądarki ani urządzenia.', flowTitle:'Przepływ kanoniczny', flowHint:'Start lokalny → wybór kontekstu → kontrola → potwierdzenie → zamknięcie.', flowStepStart:'Start', flowStepContext:'Wybór kontekstu', flowStepReview:'Kontrola', flowStepConfirm:'Potwierdzenie', completedLabel:'Gotowe', blockedLabel:'Zablokowane', confirmedLabel:'Potwierdzone', closedLabel:'Zamknięte', localOnlyNote:'Wszystkie działania i wyniki pozostają lokalne.', continueToChecks:'Przejdź do kontroli', selectContextFeedback:'Wybierz co najmniej jeden kontekst.', progressLabel:'Postęp kontroli', automaticSummaryTitle:'Podsumowanie automatyczne', automaticSummaryHint:'Wskaźniki informacyjne są aktualizowane automatycznie.', stepsTitle:'Etapy kontroli', stepsHint:'Etapy aktualizują się podczas procesu.', contexts:{local:'Transport lokalny','long-distance':'Transport dalekobieżny',adr:'Kontekst ADR',night:'Warunki nocne','adverse-weather':'Trudne warunki pogodowe'}, states:{NOT_STARTED:'Nie rozpoczęto',CONTEXT_SELECTION:'Wybór kontekstu',IN_PROGRESS:'W toku',NEEDS_ATTENTION:'Wymaga uwagi',BLOCKED:'Zablokowane',READY_TO_CONFIRM:'Gotowe do potwierdzenia',CONFIRMED:'Potwierdzone',CLOSED:'Zamknięte'}, checks:{vehicle:'Stan i bezpieczeństwo pojazdu',driver:'Dyspozycja i stan kierowcy',documents:'Dokumenty transportowe',tachograph:'Tachograf i czasy',cargo:'Ładunek i mocowanie',route:'Trasa i ograniczenia',adr:'Kontrola ADR',weather:'Noc / pogoda'}, actions:{confirmed:'Potwierdzone',problem:'Problem',na:'Nie dotyczy',edit:'Edytuj'}, summary:{contexts:'Konteksty',checks:'Kontrole',answers:'Odpowiedzi',problems:'Otwarte problemy',incomplete:'Nieukończone elementy'} },
  tr: { ...basePreDepartureCopy.en, title:'Yola çıkmadan önce', intro:'Yolculuk başlamadan önce yerel, erişilebilir ve doğrulanabilir akış.', mode:'Dil', status:'Durum', stateLabel:'Mevcut durum', contextsLabel:'Seçilen bağlamlar', checksLabel:'Uygulanabilir kontroller', noChecks:'Henüz kontrol yok. En az bir bağlam seçin.', start:'Değerlendirmeyi başlat', resume:'Oturumu sürdür', reset:'Oturumu sıfırla', confirmReady:'Hazır olduğunu onayla', reviewAssessment:'Kontrolleri tamamla', close:'Oturumu kapat', save:'Yerel olarak kaydet', restore:'Yerel olarak geri yükle', offline:'Cihaz çevrimdışı. Oturum harici aktarım olmadan yerel olarak sürer.', languageHint:'9 dilin tümü aynı mantığı ve durumları korur.', limits:'Hiçbir yanıt tarayıcıdan veya cihazdan çıkmaz.', flowTitle:'Standart akış', flowHint:'Yerel başlangıç → bağlam seçimi → kontrol → onay → kapatma.', flowStepStart:'Başlangıç', flowStepContext:'Bağlam seçimi', flowStepReview:'Kontrol', flowStepConfirm:'Onay', completedLabel:'Tamamlandı', blockedLabel:'Engellendi', confirmedLabel:'Onaylandı', closedLabel:'Kapandı', localOnlyNote:'Tüm eylemler ve sonuçlar yerel kalır.', continueToChecks:'Kontrollere devam et', selectContextFeedback:'En az bir bağlam seçin.', progressLabel:'Kontrol ilerlemesi', automaticSummaryTitle:'Otomatik özet', automaticSummaryHint:'Bilgi göstergeleri otomatik güncellenir.', stepsTitle:'Kontrol adımları', stepsHint:'Adımlar akış sırasında güncellenir.', contexts:{local:'Yerel taşıma','long-distance':'Uzun mesafe taşımacılığı',adr:'ADR bağlamı',night:'Gece koşulları','adverse-weather':'Zorlu hava koşulları'}, states:{NOT_STARTED:'Başlamadı',CONTEXT_SELECTION:'Bağlam seçimi',IN_PROGRESS:'Devam ediyor',NEEDS_ATTENTION:'Dikkat gerekli',BLOCKED:'Engellendi',READY_TO_CONFIRM:'Onaya hazır',CONFIRMED:'Onaylandı',CLOSED:'Kapandı'}, checks:{vehicle:'Araç durumu ve güvenliği',driver:'Sürücü uygunluğu ve durumu',documents:'Taşıma belgeleri',tachograph:'Takograf ve süreler',cargo:'Yük ve sabitleme',route:'Rota ve kısıtlamalar',adr:'ADR kontrolü',weather:'Gece / hava'}, actions:{confirmed:'Onaylandı',problem:'Sorun',na:'Uygulanamaz',edit:'Düzenle'}, summary:{contexts:'Bağlamlar',checks:'Kontroller',answers:'Yanıtlar',problems:'Açık sorunlar',incomplete:'Eksik öğeler'} },
  sq: { ...basePreDepartureCopy.en, title:'Para nisjes', intro:'Proces lokal, i qasshëm dhe i verifikueshëm para nisjes.', mode:'Gjuha', status:'Gjendja', stateLabel:'Gjendja aktuale', contextsLabel:'Kontekstet e zgjedhura', checksLabel:'Kontrollet e zbatueshme', noChecks:'Nuk ka ende kontrolle. Zgjidhni të paktën një kontekst.', start:'Fillo vlerësimin', resume:'Vazhdo seancën', reset:'Rivendos seancën', confirmReady:'Konfirmo gatishmërinë', reviewAssessment:'Përfundo kontrollet', close:'Mbyll seancën', save:'Ruaj lokalisht', restore:'Rikthe lokalisht', offline:'Pajisja është jashtë linje. Seanca vazhdon lokalisht pa transmetim.', languageHint:'Të 9 gjuhët ruajnë të njëjtën logjikë dhe gjendje.', limits:'Asnjë përgjigje nuk largohet nga shfletuesi ose pajisja.', flowTitle:'Rrjedha standarde', flowHint:'Fillimi lokal → zgjedhja e kontekstit → kontrolli → konfirmimi → mbyllja.', flowStepStart:'Fillimi', flowStepContext:'Zgjedhja e kontekstit', flowStepReview:'Kontrolli', flowStepConfirm:'Konfirmimi', completedLabel:'Përfunduar', blockedLabel:'Bllokuar', confirmedLabel:'Konfirmuar', closedLabel:'Mbyllur', localOnlyNote:'Të gjitha veprimet dhe rezultatet mbeten lokale.', continueToChecks:'Vazhdo te kontrollet', selectContextFeedback:'Zgjidhni të paktën një kontekst.', progressLabel:'Përparimi', automaticSummaryTitle:'Përmbledhje automatike', automaticSummaryHint:'Treguesit informues përditësohen automatikisht.', stepsTitle:'Hapat e kontrollit', stepsHint:'Hapat përditësohen gjatë procesit.', contexts:{local:'Transport lokal','long-distance':'Transport në distancë të gjatë',adr:'Kontekst ADR',night:'Kushte nate','adverse-weather':'Kushte të vështira moti'}, states:{NOT_STARTED:'Nuk ka filluar',CONTEXT_SELECTION:'Zgjedhja e kontekstit',IN_PROGRESS:'Në proces',NEEDS_ATTENTION:'Kërkon vëmendje',BLOCKED:'Bllokuar',READY_TO_CONFIRM:'Gati për konfirmim',CONFIRMED:'Konfirmuar',CLOSED:'Mbyllur'}, checks:{vehicle:'Gjendja dhe siguria e automjetit',driver:'Aftësia dhe gjendja e shoferit',documents:'Dokumentet e transportit',tachograph:'Tahografi dhe kohët',cargo:'Ngarkesa dhe sigurimi',route:'Rruga dhe kufizimet',adr:'Kontrolli ADR',weather:'Nata / moti'}, actions:{confirmed:'Konfirmuar',problem:'Problem',na:'Nuk zbatohet',edit:'Ndrysho'}, summary:{contexts:'Kontekstet',checks:'Kontrollet',answers:'Përgjigjet',problems:'Probleme të hapura',incomplete:'Elemente të papërfunduara'} },
};

Object.assign(additionalPreDepartureCopy.fr, {
  issueRegisterTitle: 'Registre des problèmes',
  issueRegisterEmpty: 'Aucun problème n’a été enregistré.',
});
Object.assign(additionalPreDepartureCopy.nl, {
  issueRegisterTitle: 'Probleemregister',
  issueRegisterEmpty: 'Er zijn geen problemen geregistreerd.',
});
Object.assign(additionalPreDepartureCopy.ru, {
  issueRegisterTitle: 'Журнал проблем',
  issueRegisterEmpty: 'Проблемы не зарегистрированы.',
});
Object.assign(additionalPreDepartureCopy.pl, {
  issueRegisterTitle: 'Rejestr problemów',
  issueRegisterEmpty: 'Nie zarejestrowano żadnych problemów.',
});
Object.assign(additionalPreDepartureCopy.tr, {
  issueRegisterTitle: 'Sorun kaydı',
  issueRegisterEmpty: 'Herhangi bir sorun kaydedilmedi.',
});
Object.assign(additionalPreDepartureCopy.sq, {
  resumeHint: 'Faqja mund të ringarkohet dhe të vazhdojë lokalisht pa humbur gjendjen e ruajtur.',
  exportReport: 'Shkarko raportin',
  issueRegisterTitle: 'Regjistri i problemeve',
  issueRegisterEmpty: 'Nuk është regjistruar asnjë problem.',
});

export const preDepartureCopy: Record<PreDepartureLanguage, PreDepartureCopy> = {
  ...basePreDepartureCopy,
  ...additionalPreDepartureCopy,
};

export function normalizePreDepartureLanguage(value: string | null | undefined): PreDepartureLanguage {
  if (preDepartureLanguages.includes(value as PreDepartureLanguage)) return value as PreDepartureLanguage;
  return 'ro';
}
