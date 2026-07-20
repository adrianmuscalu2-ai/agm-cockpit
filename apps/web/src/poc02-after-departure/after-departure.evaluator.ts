import type {
  AfterDepartureAssessment,
  AfterDepartureAssessmentInput,
  AfterDepartureFactValue,
  AfterDepartureScenario,
  AfterDepartureScenarioPolicy,
  AfterDepartureState,
} from './after-departure.types';

const sharedLimitations = [
  'AGM oferă asistență operațională, nu aviz juridic, medical sau tehnic.',
  'Instrucțiunile autorităților și serviciilor de urgență au prioritate.',
  'Orice mesaj, apel sau transmitere externă necesită confirmarea utilizatorului.',
] as const;

export const afterDeparturePolicies: Readonly<
  Record<AfterDepartureScenario, AfterDepartureScenarioPolicy>
> = {
  'road-control': {
    priority: 'P2',
    requiredFacts: ['authorityRequest', 'approximateLocation'],
    immediateActions: [
      'Confirmă că vehiculul este oprit în siguranță.',
      'Clarifică documentul sau informația solicitată.',
      'Prezintă numai datele disponibile și confirmate.',
    ],
    escalation: ['autoritate', 'operator'],
    prohibitedActions: [
      'Nu obstrucționa controlul.',
      'Nu semna un text pe care nu îl înțelegi.',
    ],
  },
  incident: {
    priority: 'P0',
    requiredFacts: ['approximateLocation', 'injuriesKnown'],
    immediateActions: [
      'Oprește fluxul normal și protejează persoanele dacă este sigur.',
      'Contactează serviciul de urgență potrivit.',
      'Comunică poziția și natura pericolului.',
    ],
    escalation: ['serviciu-urgență', 'autoritate', 'operator'],
    prohibitedActions: [
      'Nu amâna apelul de urgență pentru completarea formularului.',
      'Nu manipula substanțe sau obiecte cu risc necunoscut.',
    ],
  },
  breakdown: {
    priority: 'P1',
    requiredFacts: ['observedSymptom', 'approximateLocation'],
    immediateActions: [
      'Oprește în siguranță dacă există risc.',
      'Descrie simptomul observat, fără diagnostic presupus.',
      'Transmite situația operatorului sau asistenței tehnice.',
    ],
    escalation: ['operator', 'asistență-tehnică'],
    prohibitedActions: [
      'Nu continua dacă siguranța nu poate fi stabilită.',
      'Nu efectua reparații periculoase pe carosabil.',
    ],
  },
  fatigue: {
    priority: 'P1',
    requiredFacts: ['observedSymptoms', 'safeStopAvailable'],
    immediateActions: [
      'Evită interacțiunea complexă în timpul conducerii.',
      'Oprește la prima posibilitate sigură.',
      'Informează operatorul că planul trebuie revizuit.',
    ],
    escalation: ['operator', 'responsabil-operațional'],
    prohibitedActions: [
      'Nu confirma continuarea doar din cauza presiunii de timp.',
      'Nu folosi aplicația în timpul conducerii.',
    ],
  },
  cargo: {
    priority: 'P1',
    requiredFacts: ['observedCargoIssue', 'leakKnown'],
    immediateActions: [
      'Nu manipula marfa când riscul este necunoscut.',
      'Oprește într-un loc adecvat dacă este sigur.',
      'Contactează operatorul și descrie semnul observat.',
    ],
    escalation: ['operator', 'responsabil-marfă', 'serviciu-urgență'],
    prohibitedActions: [
      'Nu desigila și nu rearanja marfa fără autorizare.',
      'Nu fotografia dintr-o poziție nesigură.',
    ],
  },
  route: {
    priority: 'P2',
    requiredFacts: ['observedRestriction', 'approximateLocation'],
    immediateActions: [
      'Respectă semnalizarea și nu intra pe ruta incertă.',
      'Transmite restricția și poziția operatorului.',
      'Așteaptă confirmarea unei rute compatibile.',
    ],
    escalation: ['operator', 'planificator-rută'],
    prohibitedActions: [
      'Nu ignora semnalizarea locală.',
      'Nu considera o hartă generală drept autorizare a rutei.',
    ],
  },
  weather: {
    priority: 'P1',
    requiredFacts: ['observedCondition', 'safeStopAvailable'],
    immediateActions: [
      'Redu expunerea și reevaluează condițiile.',
      'Oprește în siguranță dacă continuarea este incertă.',
      'Informează operatorul despre întârziere.',
    ],
    escalation: ['operator', 'serviciu-rutier'],
    prohibitedActions: [
      'Nu folosi o viteză universală recomandată de aplicație.',
      'Nu contrazice avertizările sau restricțiile oficiale.',
    ],
  },
  language: {
    priority: 'P3',
    requiredFacts: ['sourceText', 'targetLanguage'],
    immediateActions: [
      'Păstrează mesajul scurt și factual.',
      'Verifică numele, adresele și numerele.',
      'Afișează textul sursă împreună cu traducerea.',
    ],
    escalation: ['interlocutor', 'operator-sau-interpret'],
    prohibitedActions: [
      'Nu prezenta traducerea drept certificată.',
      'Nu transmite textul fără verificarea utilizatorului.',
    ],
  },
};

const allowedTransitions: Readonly<Record<AfterDepartureState, readonly AfterDepartureState[]>> = {
  NEW: ['UNSAFE_TO_INTERACT', 'EMERGENCY', 'NEEDS_FACTS', 'ASSESSED', 'AWAITING_CONFIRMATION'],
  UNSAFE_TO_INTERACT: ['EMERGENCY', 'NEEDS_FACTS', 'ASSESSED', 'CLOSED'],
  EMERGENCY: ['ESCALATED', 'CLOSED'],
  NEEDS_FACTS: ['EMERGENCY', 'ASSESSED', 'AWAITING_CONFIRMATION', 'CLOSED'],
  ASSESSED: ['EMERGENCY', 'AWAITING_CONFIRMATION', 'ESCALATED', 'SAFE_TO_CONTINUE', 'CLOSED'],
  AWAITING_CONFIRMATION: ['EMERGENCY', 'ASSESSED', 'ESCALATED', 'CLOSED'],
  ESCALATED: ['EMERGENCY', 'SAFE_TO_CONTINUE', 'CLOSED'],
  SAFE_TO_CONTINUE: ['EMERGENCY', 'CLOSED'],
  CLOSED: [],
};

function isKnownFact(value: AfterDepartureFactValue | undefined): value is AfterDepartureFactValue {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined;
}

function knownFacts(input: AfterDepartureAssessmentInput) {
  return Object.fromEntries(
    Object.entries(input.facts ?? {}).filter(
      (entry): entry is [string, AfterDepartureFactValue] => isKnownFact(entry[1]),
    ),
  );
}

function emergencyActions(policy: AfterDepartureScenarioPolicy) {
  if (policy.priority === 'P0') return policy.immediateActions.slice(0, 3);
  return [
    'Oprește fluxul normal și prioritizează siguranța persoanelor.',
    'Contactează serviciul de urgență potrivit.',
    'Urmează instrucțiunile autorităților și serviciilor de urgență.',
  ];
}

export function canTransitionAfterDeparture(
  from: AfterDepartureState,
  to: AfterDepartureState,
) {
  return allowedTransitions[from].includes(to);
}

export function assessAfterDepartureSituation(
  input: AfterDepartureAssessmentInput,
): AfterDepartureAssessment {
  const policy = afterDeparturePolicies[input.scenario];
  const facts = knownFacts(input);
  const missingFacts = policy.requiredFacts.filter((key) => !(key in facts));

  if (input.immediateDanger) {
    return {
      scenario: input.scenario,
      state: 'EMERGENCY',
      priority: 'P0',
      knownFacts: facts,
      missingFacts,
      immediateActions: emergencyActions(policy),
      escalation: ['serviciu-urgență', ...policy.escalation].filter(
        (value, index, values) => values.indexOf(value) === index,
      ),
      confirmationRequired: true,
      canContinue: false,
      prohibitedActions: policy.prohibitedActions,
      limitations: sharedLimitations,
    };
  }

  if (!input.safeToInteract) {
    return {
      scenario: input.scenario,
      state: 'UNSAFE_TO_INTERACT',
      priority: policy.priority === 'P3' ? 'P1' : policy.priority,
      knownFacts: facts,
      missingFacts,
      immediateActions: [
        'Nu utiliza fluxul detaliat în timpul conducerii.',
        'Oprește la prima posibilitate sigură.',
      ],
      escalation: [],
      confirmationRequired: false,
      canContinue: false,
      prohibitedActions: ['Nu interacționa cu aplicația în timpul conducerii.'],
      limitations: sharedLimitations,
    };
  }

  const state: AfterDepartureState = missingFacts.length
    ? 'NEEDS_FACTS'
    : input.externalActionRequested
      ? 'AWAITING_CONFIRMATION'
      : 'ASSESSED';

  return {
    scenario: input.scenario,
    state,
    priority: policy.priority,
    knownFacts: facts,
    missingFacts,
    immediateActions: policy.immediateActions.slice(0, 3),
    escalation: policy.escalation,
    confirmationRequired: Boolean(input.externalActionRequested),
    canContinue: false,
    prohibitedActions: policy.prohibitedActions,
    limitations: sharedLimitations,
  };
}

