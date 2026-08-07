export type TachographEvent =
  | 'driving'
  | 'break-rest'
  | 'manual-entry'
  | 'card-problem'
  | 'device-error'
  | 'printout'
  | 'country-entry';

export type TachographFact = {
  label: string;
  value: string;
  origin: 'ocr-confirmed';
};

export type TachographAnalysisResult = {
  context: 'tachograph';
  status: 'identified' | 'partial' | 'uncertain';
  event?: TachographEvent;
  summary: string;
  facts: TachographFact[];
  explanation: string;
  recommendedActions: string[];
  warnings: string[];
  confidence: number;
  limitations: string[];
  knowledgeReferences: ['KB-LEGAL-TACH-001'];
};

const eventDefinitions: ReadonlyArray<{
  event: TachographEvent;
  label: string;
  pattern: RegExp;
}> = [
  // Evaluate this warning before the generic "driving" activity rule.
  { event: 'card-problem', label: 'Conducere fără card tahograf', pattern: /(?:driving\s+(?:without|whithout)\s+(?:a\s+)?card|conducere\s+f[aă]r[aă]\s+card|jazda\s+bez\s+karty|fahrt\s+ohne\s+karte)/i },
  { event: 'card-problem', label: 'Problemă card tahograf', pattern: /card(?:ul)?[^\n]{0,30}(?:invalid|expirat|eroare|error|fehler|ung[uü]ltig)|(?:invalid|expired)\s+card/i },
  { event: 'device-error', label: 'Eroare sau eveniment tahograf', pattern: /(?:eroare|error|fehler|event|eveniment|interruption|[iî]ntrerupere|overspeed|vitez[aă])/i },
  { event: 'manual-entry', label: 'Introducere manuală', pattern: /(?:introducere|intrare|entry|eingabe)[^\n]{0,20}(?:manual|manuell)/i },
  { event: 'break-rest', label: 'Pauză sau odihnă', pattern: /(?:pauz[aă]|odihn[aă]|break|rest|ruhezeit|pause)/i },
  { event: 'driving', label: 'Activitate de conducere', pattern: /(?:conducere|driving|lenkzeit|fahrt)/i },
  { event: 'printout', label: 'Imprimare tahograf', pattern: /(?:imprimare|printout|print|ausdruck)/i },
  { event: 'country-entry', label: 'Introducere țară', pattern: /(?:[tț]ar[aă]|country|land)[\s:.-]+[a-z]{1,20}/i },
];

export function analyzeTachographText(confirmedText: string, ocrConfidence: number): TachographAnalysisResult {
  const text = normalize(confirmedText);
  const detected = eventDefinitions.find(({ pattern }) => pattern.test(text));
  const facts = extractFacts(text, detected?.label);
  const status = detected && facts.length >= 2 ? 'identified' : detected || facts.length >= 2 ? 'partial' : 'uncertain';
  const confidence = Math.max(0, Math.min(100, Math.round(
    Math.min(ocrConfidence, 86) * 0.68 + (detected ? 16 : 0) + Math.min(12, facts.length * 3),
  )));

  return {
    context: 'tachograph',
    status,
    event: detected?.event,
    summary: summaryFor(status, detected?.label),
    facts,
    explanation: explanationFor(status, detected?.event),
    recommendedActions: actionsFor(status, detected?.event),
    warnings: warningsFor(text, status, detected?.event),
    confidence,
    limitations: [
      'Rezultatul folosește numai textul OCR confirmat de utilizator.',
      'AGM nu calculează soldul legal complet al timpilor de conducere și odihnă dintr-o singură fotografie.',
      'Înregistrarea tahografului și instrucțiunile oficiale ale aparatului au prioritate.',
    ],
    knowledgeReferences: ['KB-LEGAL-TACH-001'],
  };
}

export function formatTachographResult(result: TachographAnalysisResult) {
  return [
    'AGM Basic — Analiză Tahograf',
    `Rezultat: ${result.summary}`,
    '',
    'Date identificate:',
    ...(result.facts.length ? result.facts.map((fact) => `- ${fact.label}: ${fact.value}`) : ['- Nu au fost identificate date suficiente.']),
    '',
    `Explicație: ${result.explanation}`,
    '',
    'Acțiuni recomandate:',
    ...result.recommendedActions.map((action) => `- ${action}`),
    ...(result.warnings.length ? ['', 'Atenționări:', ...result.warnings.map((warning) => `- ${warning}`)] : []),
    '',
    `Încredere orientativă: ${result.confidence}%`,
    'Referință: KB-LEGAL-TACH-001',
  ].join('\n');
}

function extractFacts(text: string, eventLabel?: string) {
  const facts: TachographFact[] = [];
  if (eventLabel) facts.push(fact('Mesaj / activitate', eventLabel));

  const times = [...text.matchAll(/\b([01]?\d|2[0-3]):[0-5]\d\b/g)].map((match) => match[0]);
  if (times.length) facts.push(fact('Ore afișate', [...new Set(times)].slice(0, 4).join(', ')));

  const duration = text.match(/\b(\d{1,2}\s*(?:h|ore|stunden)\s*(?:\d{1,2}\s*(?:m|min|minuten))?|\d{1,3}\s*(?:m|min|minuten))\b/i)?.[1];
  if (duration) facts.push(fact('Durată afișată', duration));

  const country = text.match(/(?:[tț]ar[aă]|country|land)[\s:.-]+([a-z]{1,20})/i)?.[1];
  if (country) facts.push(fact('Țară afișată', country.toUpperCase()));

  const date = text.match(/\b((?:\d{1,2}[./-]){2}\d{2,4})\b/)?.[1];
  if (date) facts.push(fact('Dată afișată', date));
  return facts;
}

function normalize(value: string) {
  return value.normalize('NFC').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function fact(label: string, value: string): TachographFact {
  return { label, value: value.trim().slice(0, 100), origin: 'ocr-confirmed' };
}

function summaryFor(status: TachographAnalysisResult['status'], eventLabel?: string) {
  if (status === 'identified') return `${eventLabel} — mesaj contextual identificat.`;
  if (status === 'partial') return eventLabel ? `${eventLabel} — informații parțiale.` : 'Date tahograf identificate parțial.';
  return 'Mesajul tahografului nu poate fi identificat suficient de sigur.';
}

function explanationFor(status: TachographAnalysisResult['status'], event?: TachographEvent) {
  if (status === 'uncertain') return 'Textul confirmat nu conține suficiente repere pentru o interpretare tahograf sigură.';
  if (event === 'card-problem') return 'Tahograful indică o posibilă problemă a cardului; cauza exactă trebuie verificată pe aparat și în instrucțiunile oficiale.';
  if (event === 'device-error') return 'Mesajul indică un eveniment sau o eroare care trebuie verificată și documentată conform indicației aparatului.';
  if (event === 'manual-entry') return 'Aparatul solicită sau indică o înregistrare manuală care trebuie verificată înainte de confirmare.';
  if (event === 'break-rest') return 'Mesajul se referă la pauză sau odihnă; fotografia singură nu permite calcularea întregului sold legal.';
  if (event === 'driving') return 'Mesajul se referă la activitatea de conducere și la timpul afișat de tahograf.';
  if (event === 'printout') return 'Mesajul se referă la imprimarea ori consultarea unei înregistrări tahograf.';
  if (event === 'country-entry') return 'Mesajul indică introducerea sau confirmarea țării în tahograf.';
  return 'Au fost găsite date tahograf, dar contextul complet trebuie confirmat pe aparat.';
}

function actionsFor(status: TachographAnalysisResult['status'], event?: TachographEvent) {
  if (status === 'uncertain') return [
    'Refă fotografia concentrând cadrul pe mesaj și pe valorile afișate.',
    'Corectează textul OCR și rulează din nou analiza.',
  ];
  const common = ['Compară textul identificat cu afișajul tahografului înainte de confirmare.'];
  if (event === 'card-problem') return [...common, 'Verifică introducerea, valabilitatea și starea cardului.', 'Urmează procedura firmei dacă problema persistă.'];
  if (event === 'device-error') return [...common, 'Notează codul și ora evenimentului.', 'Păstrează imprimarea sau dovada cerută și escaladează conform procedurii firmei.'];
  if (event === 'manual-entry') return [...common, 'Verifică intervalul și activitatea înainte de salvarea introducerii manuale.'];
  if (event === 'break-rest' || event === 'driving') return [...common, 'Verifică activitatea selectată și soldurile complete direct pe tahograf.'];
  if (event === 'country-entry') return [...common, 'Confirmă țara corectă înainte de continuare.'];
  return [...common, 'Consultă instrucțiunea aparatului pentru mesajul exact.'];
}

function warningsFor(text: string, status: TachographAnalysisResult['status'], event?: TachographEvent) {
  const warnings: string[] = [];
  if (status !== 'identified') warnings.push('Interpretarea este parțială; nu lua o decizie numai pe baza acestei fotografii.');
  if (event === 'device-error' || /!|stop|oprire/i.test(text)) warnings.push('Nu ignora mesajul de eroare sau evenimentul afișat.');
  return warnings;
}
