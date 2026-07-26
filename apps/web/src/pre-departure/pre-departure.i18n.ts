import type { PreDepartureContext, PreDepartureState } from './pre-departure.types';

export type PreDepartureLanguage = 'ro' | 'de' | 'en';

export const preDepartureLanguages: readonly PreDepartureLanguage[] = ['ro', 'de', 'en'];

export const preDepartureLanguageLabels: Record<PreDepartureLanguage, string> = {
  ro: 'RO',
  de: 'DE',
  en: 'EN',
};

export const preDepartureCopy: Record<
  PreDepartureLanguage,
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

export function normalizePreDepartureLanguage(value: string | null | undefined): PreDepartureLanguage {
  if (value === 'de' || value === 'en') return value;
  return 'ro';
}
