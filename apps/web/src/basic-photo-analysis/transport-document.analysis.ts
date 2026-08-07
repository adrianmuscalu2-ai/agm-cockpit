export type TransportDocumentFactKey =
  | 'documentType'
  | 'documentNumber'
  | 'date'
  | 'sender'
  | 'recipient'
  | 'carrier'
  | 'vehicle'
  | 'weight';

export type TransportDocumentFact = {
  key: TransportDocumentFactKey;
  label: string;
  value: string;
  origin: 'ocr-confirmed';
};

export type TransportDocumentAnalysisResult = {
  context: 'transport-document';
  status: 'identified' | 'partial' | 'uncertain';
  summary: string;
  facts: TransportDocumentFact[];
  explanation: string;
  recommendedActions: string[];
  warnings: string[];
  confidence: number;
  limitations: string[];
  knowledgeReferences: ['KB-LEGAL-TRANSPORT-DOCS-001'];
};

const fieldDefinitions: ReadonlyArray<{
  key: TransportDocumentFactKey;
  label: string;
  patterns: RegExp[];
}> = [
  { key: 'documentNumber', label: 'Număr document', patterns: [/(?:\bcmr\b\s*)?\b(?:nr|no|number|num[aă]r|document|doc)\b\.?[\s:#-]+([a-z0-9][a-z0-9/-]{2,})/i, /\baviz\b\s+(?:nr\.?)?[\s:#-]*([a-z0-9][a-z0-9/-]{2,})/i] },
  { key: 'date', label: 'Dată', patterns: [/(?:data|date|datum)[\s:.-]*((?:\d{1,2}[./-]){2}\d{2,4})/i, /\b((?:\d{1,2}[./-]){2}\d{2,4})\b/] },
  { key: 'sender', label: 'Expeditor', patterns: [/(?:expeditor|sender|absender)[\s:.-]+([^\n]{3,80})/i] },
  { key: 'recipient', label: 'Destinatar', patterns: [/(?:destinatar|consignee|empf[aä]nger)[\s:.-]+([^\n]{3,80})/i] },
  { key: 'carrier', label: 'Transportator', patterns: [/(?:transportator|carrier|frachtf[uü]hrer)[\s:.-]+([^\n]{3,80})/i] },
  { key: 'vehicle', label: 'Vehicul / înmatriculare', patterns: [/(?:\bvehicul\b|\bvehicle\b|\bkennzeichen\b|\bnr\.?\s*auto\b)[\s:.-]+([a-z0-9 -]{4,20})/i, /\b([A-Z]{2,3}[ -]?\d{2,4}[ -]?[A-Z]{1,3})\b/] },
  { key: 'weight', label: 'Masă / cantitate', patterns: [/(?:greutate|weight|gewicht|mas[aă]|total)[\s:.-]*([\d.,]+\s*(?:kg|t|tone|tonnes?))/i, /\b([\d.,]+\s*(?:kg|tone|tonnes?))\b/i] },
];

export function analyzeTransportDocument(
  confirmedText: string,
  ocrConfidence: number,
): TransportDocumentAnalysisResult {
  const text = normalizeConfirmedText(confirmedText);
  const facts: TransportDocumentFact[] = [];
  const documentType = detectDocumentType(text);
  if (documentType) facts.push(fact('documentType', 'Tip document', documentType));

  for (const definition of fieldDefinitions) {
    const value = firstMatch(text, definition.patterns);
    if (value) facts.push(fact(definition.key, definition.label, value));
  }

  const status = documentType && facts.length >= 3
    ? 'identified'
    : documentType || facts.length >= 2
      ? 'partial'
      : 'uncertain';
  const confidence = Math.max(0, Math.min(100, Math.round(
    Math.min(ocrConfidence, 85) * 0.65 + Math.min(15, facts.length * 3) + (documentType ? 8 : 0),
  )));
  const missing = missingImportantFacts(facts);

  return {
    context: 'transport-document',
    status,
    summary: summaryFor(status, documentType, facts.length),
    facts,
    explanation: explanationFor(status, missing),
    recommendedActions: actionsFor(status, missing),
    warnings: warningsFor(text, status),
    confidence,
    limitations: [
      'Rezultatul folosește numai textul OCR confirmat de utilizator.',
      'AGM nu certifică autenticitatea, semnătura sau valabilitatea juridică a documentului.',
    ],
    knowledgeReferences: ['KB-LEGAL-TRANSPORT-DOCS-001'],
  };
}

export function formatTransportDocumentResult(result: TransportDocumentAnalysisResult) {
  return [
    `AGM Basic — Analiză document de transport`,
    `Rezultat: ${result.summary}`,
    '',
    'Date identificate:',
    ...(result.facts.length ? result.facts.map((item) => `- ${item.label}: ${item.value}`) : ['- Nu au fost identificate câmpuri sigure.']),
    '',
    `Explicație: ${result.explanation}`,
    '',
    'Acțiuni recomandate:',
    ...result.recommendedActions.map((action) => `- ${action}`),
    ...(result.warnings.length ? ['', 'Atenționări:', ...result.warnings.map((warning) => `- ${warning}`)] : []),
    '',
    `Încredere orientativă: ${result.confidence}%`,
  ].join('\n');
}

function normalizeConfirmedText(value: string) {
  return value.normalize('NFC').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function detectDocumentType(text: string) {
  if (/\bcmr\b|scrisoare de tr[aă]sur[aă]|consignment note|frachtbrief/i.test(text)) return 'Scrisoare de trăsură CMR';
  if (/aviz(?: de înso[tț]ire)?/i.test(text)) return 'Aviz de însoțire';
  if (/lieferschein|delivery note/i.test(text)) return 'Document de livrare';
  if (/factur[aă]|invoice|rechnung/i.test(text)) return 'Factură asociată transportului';
  return undefined;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim().replace(/[|]+$/g, '').trim();
    if (match) return match.slice(0, 100);
  }
  return undefined;
}

function fact(key: TransportDocumentFactKey, label: string, value: string): TransportDocumentFact {
  return { key, label, value, origin: 'ocr-confirmed' };
}

function missingImportantFacts(facts: TransportDocumentFact[]) {
  const present = new Set(facts.map(({ key }) => key));
  return [
    ['documentNumber', 'numărul documentului'],
    ['date', 'data'],
    ['sender', 'expeditorul'],
    ['recipient', 'destinatarul'],
  ].filter(([key]) => !present.has(key as TransportDocumentFactKey)).map(([, label]) => label);
}

function summaryFor(status: TransportDocumentAnalysisResult['status'], documentType: string | undefined, count: number) {
  if (status === 'identified') return `${documentType} identificat, cu ${count - 1} câmpuri relevante extrase.`;
  if (status === 'partial') return `Document de transport analizat parțial; au fost extrase ${count} informații.`;
  return 'Documentul nu poate fi identificat suficient de sigur din textul confirmat.';
}

function explanationFor(status: TransportDocumentAnalysisResult['status'], missing: string[]) {
  if (status === 'uncertain') return 'Textul confirmat nu conține suficiente repere pentru o interpretare contextuală sigură.';
  if (missing.length) return `Documentul conține informații utile, dar trebuie verificate: ${missing.join(', ')}.`;
  return 'Câmpurile principale au fost găsite în textul confirmat și pot fi verificate înainte de utilizare.';
}

function actionsFor(status: TransportDocumentAnalysisResult['status'], missing: string[]) {
  if (status === 'uncertain') return [
    'Refă fotografia cu documentul drept, complet și bine luminat.',
    'Corectează manual textul OCR și rulează din nou analiza.',
  ];
  return [
    'Compară datele identificate cu documentul original.',
    ...(missing.length ? [`Completează sau verifică ${missing.join(', ')}.`] : []),
    'Nu confirma preluarea sau livrarea dacă datele esențiale nu corespund.',
  ];
}

function warningsFor(text: string, status: TransportDocumentAnalysisResult['status']) {
  const warnings: string[] = [];
  if (status !== 'identified') warnings.push('Identificarea este parțială; verificarea documentului original este obligatorie.');
  if (/anulat|cancelled|storno|ung[uü]ltig/i.test(text)) warnings.push('Textul poate indica un document anulat sau nevalabil.');
  return warnings;
}
