import type {
  AfterDepartureAssessment,
  AfterDepartureScenario,
} from './after-departure.types';
import type { AfterDepartureLanguage } from './after-departure.i18n';
import { finalLanguageOperationalDictionary } from '../i18n/final-language-operational.dictionary';

type ScenarioContent = {
  actions: readonly string[];
  prohibited: readonly string[];
};

const de: Record<AfterDepartureScenario, ScenarioContent> = {
  'road-control': {
    actions: ['Bestätigen Sie, dass das Fahrzeug sicher steht.', 'Klären Sie das angeforderte Dokument oder die Information.', 'Zeigen Sie nur verfügbare und bestätigte Angaben.'],
    prohibited: ['Behindern Sie die Kontrolle nicht.', 'Unterschreiben Sie keinen Text, den Sie nicht verstehen.'],
  },
  incident: {
    actions: ['Stoppen Sie den normalen Ablauf und schützen Sie Personen, wenn dies sicher ist.', 'Kontaktieren Sie den zuständigen Notdienst.', 'Übermitteln Sie Standort und Art der Gefahr.'],
    prohibited: ['Verzögern Sie den Notruf nicht wegen des Formulars.', 'Berühren Sie keine Stoffe oder Gegenstände mit unbekanntem Risiko.'],
  },
  breakdown: {
    actions: ['Halten Sie sicher an, wenn ein Risiko besteht.', 'Beschreiben Sie das beobachtete Symptom ohne vermutete Diagnose.', 'Melden Sie die Situation dem Betreiber oder Pannendienst.'],
    prohibited: ['Fahren Sie nicht weiter, wenn die Sicherheit unklar ist.', 'Führen Sie keine gefährlichen Reparaturen auf der Fahrbahn durch.'],
  },
  fatigue: {
    actions: ['Vermeiden Sie komplexe Interaktion während der Fahrt.', 'Halten Sie bei der ersten sicheren Möglichkeit an.', 'Informieren Sie den Betreiber, dass der Plan angepasst werden muss.'],
    prohibited: ['Bestätigen Sie die Weiterfahrt nicht nur wegen Zeitdruck.', 'Benutzen Sie die Anwendung nicht während der Fahrt.'],
  },
  cargo: {
    actions: ['Berühren Sie die Ladung nicht, wenn das Risiko unbekannt ist.', 'Halten Sie an einem geeigneten Ort, wenn dies sicher ist.', 'Kontaktieren Sie den Betreiber und beschreiben Sie die Beobachtung.'],
    prohibited: ['Öffnen oder ordnen Sie die Ladung nicht ohne Freigabe.', 'Fotografieren Sie nicht aus einer unsicheren Position.'],
  },
  route: {
    actions: ['Beachten Sie die Beschilderung und fahren Sie nicht in die unsichere Route.', 'Melden Sie Einschränkung und Standort dem Betreiber.', 'Warten Sie auf die Bestätigung einer kompatiblen Route.'],
    prohibited: ['Ignorieren Sie die örtliche Beschilderung nicht.', 'Behandeln Sie eine allgemeine Karte nicht als Routenfreigabe.'],
  },
  weather: {
    actions: ['Verringern Sie die Exposition und bewerten Sie die Bedingungen neu.', 'Halten Sie sicher an, wenn die Weiterfahrt unklar ist.', 'Informieren Sie den Betreiber über die Verzögerung.'],
    prohibited: ['Verwenden Sie keine von der Anwendung vorgegebene Universalgeschwindigkeit.', 'Widersprechen Sie keinen offiziellen Warnungen oder Einschränkungen.'],
  },
  language: {
    actions: ['Halten Sie die Nachricht kurz und sachlich.', 'Prüfen Sie Namen, Adressen und Zahlen.', 'Zeigen Sie Ausgangstext und Übersetzung gemeinsam.'],
    prohibited: ['Stellen Sie die Übersetzung nicht als zertifiziert dar.', 'Senden Sie den Text nicht ohne Prüfung.'],
  },
};

const en: Record<AfterDepartureScenario, ScenarioContent> = {
  'road-control': {
    actions: ['Confirm that the vehicle is safely stopped.', 'Clarify the requested document or information.', 'Present only available and confirmed information.'],
    prohibited: ['Do not obstruct the control.', 'Do not sign text you do not understand.'],
  },
  incident: {
    actions: ['Stop the normal flow and protect people when safe.', 'Contact the appropriate emergency service.', 'Communicate the location and nature of the danger.'],
    prohibited: ['Do not delay an emergency call to complete the form.', 'Do not handle substances or objects with unknown risk.'],
  },
  breakdown: {
    actions: ['Stop safely when there is a risk.', 'Describe the observed symptom without assuming a diagnosis.', 'Report the situation to the operator or roadside assistance.'],
    prohibited: ['Do not continue when safety cannot be established.', 'Do not perform dangerous repairs on the roadway.'],
  },
  fatigue: {
    actions: ['Avoid complex interaction while driving.', 'Stop at the first safe opportunity.', 'Tell the operator that the plan must be revised.'],
    prohibited: ['Do not confirm continuation solely because of time pressure.', 'Do not use the application while driving.'],
  },
  cargo: {
    actions: ['Do not handle cargo when the risk is unknown.', 'Stop in a suitable place when safe.', 'Contact the operator and describe the observed sign.'],
    prohibited: ['Do not unseal or rearrange cargo without authorization.', 'Do not take photographs from an unsafe position.'],
  },
  route: {
    actions: ['Follow signs and do not enter the uncertain route.', 'Report the restriction and location to the operator.', 'Wait for confirmation of a compatible route.'],
    prohibited: ['Do not ignore local signs.', 'Do not treat a general map as route authorization.'],
  },
  weather: {
    actions: ['Reduce exposure and reassess conditions.', 'Stop safely when continuation is uncertain.', 'Inform the operator about the delay.'],
    prohibited: ['Do not use a universal speed recommended by the application.', 'Do not contradict official warnings or restrictions.'],
  },
  language: {
    actions: ['Keep the message short and factual.', 'Check names, addresses, and numbers.', 'Show the source text together with the translation.'],
    prohibited: ['Do not present the translation as certified.', 'Do not transmit the text without review.'],
  },
};

const limitations = {
  de: [
    'AGM bietet operative Unterstützung, keine Rechts-, Medizin- oder Technikberatung.',
    'Anweisungen von Behörden und Notdiensten haben Vorrang.',
    'Jede externe Nachricht, jeder Anruf oder jede Übertragung erfordert eine Bestätigung.',
  ],
  en: [
    'AGM provides operational assistance, not legal, medical, or technical advice.',
    'Instructions from authorities and emergency services take priority.',
    'Every external message, call, or transmission requires user confirmation.',
  ],
} as const;

const escalationLabels: Partial<Record<Exclude<AfterDepartureLanguage, 'ro'>, Record<string, string>>> = {
  de: {
    autoritate: 'Behörde', operator: 'Betreiber', 'serviciu-urgență': 'Notdienst',
    'asistență-tehnică': 'Pannendienst', 'responsabil-operațional': 'Betriebsverantwortlicher',
    'responsabil-marfă': 'Ladungsverantwortlicher', 'planificator-rută': 'Routenplaner',
    'serviciu-rutier': 'Straßendienst', interlocutor: 'Gesprächspartner',
    'operator-sau-interpret': 'Betreiber oder Dolmetscher',
  },
  en: {
    autoritate: 'authority', operator: 'operator', 'serviciu-urgență': 'emergency service',
    'asistență-tehnică': 'roadside assistance', 'responsabil-operațional': 'operations manager',
    'responsabil-marfă': 'cargo specialist', 'planificator-rută': 'route planner',
    'serviciu-rutier': 'road service', interlocutor: 'other party',
    'operator-sau-interpret': 'operator or interpreter',
  },
};

const factLabels: Partial<Record<Exclude<AfterDepartureLanguage, 'ro'>, Record<string, string>>> = {
  de: {
    authorityRequest: 'Anforderung der Behörde', approximateLocation: 'ungefährer Standort',
    injuriesKnown: 'Status verletzter Personen', observedSymptom: 'beobachtetes Symptom',
    observedSymptoms: 'beobachtete Anzeichen', safeStopAvailable: 'sichere Haltemöglichkeit',
    observedCargoIssue: 'beobachtetes Ladungsproblem', leakKnown: 'Status einer Leckage',
    observedRestriction: 'beobachtete Einschränkung', observedCondition: 'beobachtete Bedingung',
    sourceText: 'Ausgangstext', targetLanguage: 'Zielsprache',
  },
  en: {
    authorityRequest: 'authority request', approximateLocation: 'approximate location',
    injuriesKnown: 'injuries status', observedSymptom: 'observed symptom',
    observedSymptoms: 'observed signs', safeStopAvailable: 'safe stop availability',
    observedCargoIssue: 'observed cargo issue', leakKnown: 'leak status',
    observedRestriction: 'observed restriction', observedCondition: 'observed condition',
    sourceText: 'source text', targetLanguage: 'target language',
  },
};

const emergencyActions = {
  de: ['Stoppen Sie den normalen Ablauf und priorisieren Sie die Sicherheit von Personen.', 'Kontaktieren Sie den zuständigen Notdienst.', 'Folgen Sie den Anweisungen von Behörden und Notdiensten.'],
  en: ['Stop the normal flow and prioritize people’s safety.', 'Contact the appropriate emergency service.', 'Follow instructions from authorities and emergency services.'],
};
const unsafeActions = {
  de: ['Verwenden Sie den ausführlichen Ablauf nicht während der Fahrt.', 'Halten Sie bei der ersten sicheren Möglichkeit an.'],
  en: ['Do not use the detailed flow while driving.', 'Stop at the first safe opportunity.'],
};

export const afterDepartureOperationalEnglish = {
  scenarios: en,
  limitations: limitations.en,
  escalationLabels: escalationLabels.en!,
  factLabels: factLabels.en!,
  emergencyActions: emergencyActions.en,
  unsafeActions: unsafeActions.en,
};

export function localizeAssessmentContent(
  assessment: AfterDepartureAssessment,
  language: AfterDepartureLanguage,
) {
  if (language === 'ro') {
    return {
      actions: assessment.immediateActions,
      prohibited: assessment.prohibitedActions,
      limitations: assessment.limitations,
      escalation: assessment.escalation,
      missingFacts: assessment.missingFacts,
    };
  }

  if (language === 'it' || language === 'es' || language === 'sv') {
    const dictionary = finalLanguageOperationalDictionary[language].afterDepartureOperational;
    const content = dictionary.scenarios[assessment.scenario];
    const actions = assessment.state === 'UNSAFE_TO_INTERACT'
      ? dictionary.unsafeActions
      : assessment.state === 'EMERGENCY' && assessment.scenario !== 'incident'
        ? dictionary.emergencyActions
        : content.actions;
    return {
      actions,
      prohibited: content.prohibited,
      limitations: dictionary.limitations,
      escalation: assessment.escalation.map((item) => dictionary.escalationLabels[item as keyof typeof dictionary.escalationLabels] ?? item),
      missingFacts: assessment.missingFacts.map((item) => dictionary.factLabels[item as keyof typeof dictionary.factLabels] ?? item),
    };
  }

  const supportedLanguage = language === 'de' ? 'de' : 'en';
  const content = (supportedLanguage === 'de' ? de : en)[assessment.scenario];
  const actions =
    assessment.state === 'UNSAFE_TO_INTERACT'
      ? unsafeActions[supportedLanguage]
      : assessment.state === 'EMERGENCY' && assessment.scenario !== 'incident'
        ? emergencyActions[supportedLanguage]
        : content.actions;

  return {
    actions,
    prohibited: content.prohibited,
    limitations: limitations[supportedLanguage],
    escalation: assessment.escalation.map((item) => escalationLabels[language]?.[item] ?? escalationLabels.en?.[item] ?? item),
    missingFacts: assessment.missingFacts.map((item) => factLabels[language]?.[item] ?? factLabels.en?.[item] ?? item),
  };
}
