import type {
  AfterDepartureScenario,
  AfterDepartureState,
} from './after-departure.types';

export type AfterDepartureLanguage = 'ro' | 'de' | 'en';

type Copy = {
  title: string;
  eyebrow: string;
  intro: string;
  safeQuestion: string;
  dangerQuestion: string;
  yes: string;
  no: string;
  scenario: string;
  facts: string;
  factHint: string;
  externalAction: string;
  evaluate: string;
  reset: string;
  offline: string;
  draftOnly: string;
  priority: string;
  state: string;
  actions: string;
  missing: string;
  escalation: string;
  prohibited: string;
  limitations: string;
  none: string;
  back: string;
  backPremium: string;
  backCockpit: string;
  escalate: string;
  stabilize: string;
  close: string;
  scenarios: Record<AfterDepartureScenario, string>;
  states: Record<AfterDepartureState, string>;
};

export const afterDepartureCopy: Record<AfterDepartureLanguage, Copy> = {
  ro: {
    title: 'După Plecare',
    eyebrow: 'AGM · ASISTENȚĂ OPERAȚIONALĂ',
    intro: 'Descrie situația numai după ce vehiculul este oprit într-un loc sigur.',
    safeQuestion: 'Poți interacționa în siguranță?',
    dangerQuestion: 'Există pericol imediat sau persoane rănite?',
    yes: 'Da',
    no: 'Nu',
    scenario: 'Situație',
    facts: 'Fapte confirmate',
    factHint: 'Completează numai ceea ce poți confirma.',
    externalAction: 'Pregătește o escaladare externă',
    evaluate: 'Evaluează situația',
    reset: 'Flux nou',
    offline: 'Dispozitivul este offline. Evaluarea locală rămâne disponibilă; transmiterea nu este activă.',
    draftOnly: 'Confirmarea produce numai o schiță locală. Nimic nu este trimis.',
    priority: 'Prioritate',
    state: 'Stare',
    actions: 'Acțiuni imediate',
    missing: 'Date lipsă',
    escalation: 'Escaladare propusă',
    prohibited: 'Nu efectua',
    limitations: 'Limitele AGM',
    none: 'Niciuna',
    back: 'Înapoi la AGM',
    backPremium: 'Înapoi la Premium',
    backCockpit: 'Cockpit AGM',
    escalate: 'Confirmă escaladarea locală',
    stabilize: 'Marchează situația stabilizată',
    close: 'Închide fluxul',
    scenarios: {
      'road-control': 'Control rutier',
      incident: 'Incident sau accident',
      breakdown: 'Avarie',
      fatigue: 'Oboseală',
      cargo: 'Marfă, fixare sau sigiliu',
      route: 'Rută blocată sau restricție',
      weather: 'Meteo sau drum',
      language: 'Barieră de limbă',
    },
    states: {
      NEW: 'Situație nouă',
      UNSAFE_TO_INTERACT: 'Interacțiune nesigură',
      EMERGENCY: 'Urgență',
      NEEDS_FACTS: 'Sunt necesare fapte',
      ASSESSED: 'Evaluată',
      AWAITING_CONFIRMATION: 'Așteaptă confirmarea',
      ESCALATED: 'Escaladat',
      SAFE_TO_CONTINUE: 'Sigur pentru continuare',
      CLOSED: 'Închis',
    },
  },
  de: {
    title: 'Nach der Abfahrt',
    eyebrow: 'AGM · OPERATIVE UNTERSTÜTZUNG',
    intro: 'Beschreiben Sie die Situation erst, wenn das Fahrzeug sicher steht.',
    safeQuestion: 'Können Sie sicher interagieren?',
    dangerQuestion: 'Besteht unmittelbare Gefahr oder gibt es Verletzte?',
    yes: 'Ja',
    no: 'Nein',
    scenario: 'Situation',
    facts: 'Bestätigte Fakten',
    factHint: 'Nur Angaben eintragen, die Sie bestätigen können.',
    externalAction: 'Externe Eskalation vorbereiten',
    evaluate: 'Situation bewerten',
    reset: 'Neuer Ablauf',
    offline: 'Das Gerät ist offline. Die lokale Bewertung bleibt verfügbar; Übertragung ist nicht aktiv.',
    draftOnly: 'Die Bestätigung erstellt nur einen lokalen Entwurf. Nichts wird gesendet.',
    priority: 'Priorität',
    state: 'Status',
    actions: 'Sofortmaßnahmen',
    missing: 'Fehlende Angaben',
    escalation: 'Vorgeschlagene Eskalation',
    prohibited: 'Nicht ausführen',
    limitations: 'AGM-Grenzen',
    none: 'Keine',
    back: 'Zurück zu AGM',
    backPremium: 'Zurück zu Premium',
    backCockpit: 'AGM Cockpit',
    escalate: 'Lokale Eskalation bestätigen',
    stabilize: 'Situation als stabil markieren',
    close: 'Ablauf schließen',
    scenarios: {
      'road-control': 'Verkehrskontrolle',
      incident: 'Vorfall oder Unfall',
      breakdown: 'Panne',
      fatigue: 'Müdigkeit',
      cargo: 'Ladung, Sicherung oder Siegel',
      route: 'Gesperrte Route oder Einschränkung',
      weather: 'Wetter oder Straße',
      language: 'Sprachbarriere',
    },
    states: {
      NEW: 'Neue Situation',
      UNSAFE_TO_INTERACT: 'Unsichere Interaktion',
      EMERGENCY: 'Notfall',
      NEEDS_FACTS: 'Fakten erforderlich',
      ASSESSED: 'Bewertet',
      AWAITING_CONFIRMATION: 'Bestätigung ausstehend',
      ESCALATED: 'Eskaliert',
      SAFE_TO_CONTINUE: 'Sichere Weiterfahrt',
      CLOSED: 'Geschlossen',
    },
  },
  en: {
    title: 'After Departure',
    eyebrow: 'AGM · OPERATIONAL ASSISTANCE',
    intro: 'Describe the situation only after the vehicle is stopped in a safe place.',
    safeQuestion: 'Can you interact safely?',
    dangerQuestion: 'Is there immediate danger or anyone injured?',
    yes: 'Yes',
    no: 'No',
    scenario: 'Situation',
    facts: 'Confirmed facts',
    factHint: 'Enter only information you can confirm.',
    externalAction: 'Prepare an external escalation',
    evaluate: 'Assess situation',
    reset: 'New flow',
    offline: 'The device is offline. Local assessment remains available; transmission is not active.',
    draftOnly: 'Confirmation creates a local draft only. Nothing is sent.',
    priority: 'Priority',
    state: 'State',
    actions: 'Immediate actions',
    missing: 'Missing facts',
    escalation: 'Suggested escalation',
    prohibited: 'Do not',
    limitations: 'AGM limitations',
    none: 'None',
    back: 'Back to AGM',
    backPremium: 'Back to Premium',
    backCockpit: 'AGM Cockpit',
    escalate: 'Confirm local escalation',
    stabilize: 'Mark situation as stable',
    close: 'Close flow',
    scenarios: {
      'road-control': 'Road control',
      incident: 'Incident or accident',
      breakdown: 'Breakdown',
      fatigue: 'Fatigue',
      cargo: 'Cargo, securing, or seal',
      route: 'Blocked route or restriction',
      weather: 'Weather or road',
      language: 'Language barrier',
    },
    states: {
      NEW: 'New situation',
      UNSAFE_TO_INTERACT: 'Unsafe to interact',
      EMERGENCY: 'Emergency',
      NEEDS_FACTS: 'Facts required',
      ASSESSED: 'Assessed',
      AWAITING_CONFIRMATION: 'Awaiting confirmation',
      ESCALATED: 'Escalated',
      SAFE_TO_CONTINUE: 'Safe to continue',
      CLOSED: 'Closed',
    },
  },
};

export function normalizeAfterDepartureLanguage(value: string | null | undefined): AfterDepartureLanguage {
  return value === 'de' || value === 'en' ? value : 'ro';
}
