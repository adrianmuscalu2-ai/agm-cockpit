export type LegislationTopic =
  | 'driving-daily'
  | 'driving-weekly'
  | 'break'
  | 'daily-rest'
  | 'weekly-rest'
  | 'exception'
  | 'cmr-scope'
  | 'cmr-required-data'
  | 'cmr-reservation'
  | 'cmr-delivery'
  | 'e-cmr';

export type LegislationFact = { label: string; value: string; origin: 'ocr-confirmed' };

export type LegislationAnalysisResult = {
  context: 'legislation';
  status: 'identified' | 'partial' | 'uncertain';
  topic?: LegislationTopic;
  summary: string;
  facts: LegislationFact[];
  explanation: string;
  recommendedActions: string[];
  warnings: string[];
  confidence: number;
  limitations: string[];
  knowledgeReferences: Array<'KB-LEGAL-DRT-001' | 'KB-LEGAL-TRANSPORT-DOCS-001'>;
};

const rules: ReadonlyArray<{
  topic: LegislationTopic;
  label: string;
  pattern: RegExp;
  reference: 'KB-LEGAL-DRT-001' | 'KB-LEGAL-TRANSPORT-DOCS-001';
  explanation: string;
  actions: string[];
}> = [
  { topic: 'break', label: 'Pauză după conducere', pattern: /4\s*h(?:\s*30|30)|4[:.]30|45\s*(?:min|minute)|pauz|break/i, reference: 'KB-LEGAL-DRT-001', explanation: 'Textul se referă la pauza după conducere. Regula generală publicată este minimum 45 minute după cel mult 4h30, inclusiv forma 15 + 30 în această ordine.', actions: ['Compară valorile OCR cu afișajul și activitățile complete.', 'Verifică ordinea și continuitatea pauzelor înainte de o concluzie.'] },
  { topic: 'driving-daily', label: 'Timp zilnic de conducere', pattern: /(?:conducere|driving|lenkzeit).{0,30}(?:9|10)\s*(?:h|ore|hours|stunden)|(?:zilnic|daily).{0,30}(?:9|10)\s*(?:h|ore|hours)/i, reference: 'KB-LEGAL-DRT-001', explanation: 'Textul se referă la timpul zilnic de conducere: limita generală este 9 ore, extensibilă la 10 ore de cel mult două ori pe săptămână.', actions: ['Verifică totalul zilei și numărul extensiilor la 10 ore din săptămână.', 'Nu trata o singură valoare fotografiată ca sold legal complet.'] },
  { topic: 'driving-weekly', label: 'Limite săptămânale de conducere', pattern: /(?:56|90)\s*(?:h|ore|hours|stunden)|săptămân|weekly|woche/i, reference: 'KB-LEGAL-DRT-001', explanation: 'Textul poate privi limitele de 56 ore într-o săptămână și 90 ore în două săptămâni consecutive; ambele se verifică simultan.', actions: ['Verifică ambele săptămâni și toate activitățile înregistrate.', 'Confirmă perioada calendaristică la care se referă valorile.'] },
  { topic: 'daily-rest', label: 'Repaus zilnic', pattern: /(?:repaus|odihn|rest|ruhezeit).{0,30}(?:9|11)\s*(?:h|ore|hours|stunden)|3\s*\+\s*9/i, reference: 'KB-LEGAL-DRT-001', explanation: 'Textul se referă la repausul zilnic normal, fracționat sau redus; tipul exact depinde de succesiunea completă și de fereastra aplicabilă.', actions: ['Verifică durata continuă și eventualele fracțiuni.', 'Verifică reducerile dintre repausurile săptămânale.'] },
  { topic: 'weekly-rest', label: 'Repaus săptămânal', pattern: /(?:repaus|odihn|rest).{0,35}(?:24|45)\s*(?:h|ore|hours)|weekly rest|wochenruhe/i, reference: 'KB-LEGAL-DRT-001', explanation: 'Textul se referă la repausul săptămânal normal sau redus; compensarea și condițiile operațiunii trebuie verificate separat.', actions: ['Confirmă tipul repausului și locul efectuării.', 'Verifică termenul și atașarea oricărei compensări.'] },
  { topic: 'exception', label: 'Abatere excepțională / art. 12', pattern: /art(?:icol)?\.?\s*12|situație excepțional|exceptional circumstance|außergewöhn/i, reference: 'KB-LEGAL-DRT-001', explanation: 'Textul indică o posibilă abatere excepțională. Aceasta nu este o regulă de planificare și cere justificare și compensare în condițiile aplicabile.', actions: ['Notează motivul concret și locul sigur vizat.', 'Verifică justificarea manuală și compensarea integrală.'] },
  { topic: 'e-cmr', label: 'e-CMR', pattern: /\be-?cmr\b|electronic consignment note/i, reference: 'KB-LEGAL-TRANSPORT-DOCS-001', explanation: 'Textul privește e-CMR. Un PDF sau o fotografie nu este automat e-CMR conform; sunt necesare integritate, autentificare și modificări trasabile.', actions: ['Verifică statele aplicabile și procedura convenită.', 'Confirmă accesul la document și istoricul modificărilor.'] },
  { topic: 'cmr-reservation', label: 'Rezerve CMR', pattern: /(?:cmr).{0,50}(?:rezerv|reservation)|ambalaj.{0,30}(?:rupt|deterior)|colet.{0,20}(?:lips|damage)/i, reference: 'KB-LEGAL-TRANSPORT-DOCS-001', explanation: 'Textul privește verificarea la preluare sau rezervele CMR. Rezerva trebuie să fie concretă și legată de documentul corect.', actions: ['Compară starea și numărul coletelor cu documentul.', 'Consemnează concret diferența și acceptarea atunci când este necesară.'] },
  { topic: 'cmr-delivery', label: 'Livrare și rezerve CMR', pattern: /(?:livrare|delivery|zustellung).{0,40}(?:rezerv|damage|deterior)|(?:7|21)\s*(?:zile|days|tage)/i, reference: 'KB-LEGAL-TRANSPORT-DOCS-001', explanation: 'Textul poate privi rezervele la livrare. Termenul și forma depind de caracterul aparent/neaparent al daunei sau de întârziere.', actions: ['Identifică persoana, data, ora și starea la livrare.', 'Verifică termenul exact și păstrează dovada scrisă.'] },
  { topic: 'cmr-required-data', label: 'Date obligatorii CMR', pattern: /\bcmr\b.{0,100}(?:expeditor|transportator|destinatar|consignee|carrier|greutate|weight)/i, reference: 'KB-LEGAL-TRANSPORT-DOCS-001', explanation: 'Textul indică date asociate scrisorii CMR. Câmpurile trebuie comparate cu marfa, comanda și ruta.', actions: ['Verifică datele esențiale și contradicțiile.', 'Nu completa informații lipsă din memorie.'] },
  { topic: 'cmr-scope', label: 'Domeniu de aplicare CMR', pattern: /\bcmr\b|consignment note|frachtbrief/i, reference: 'KB-LEGAL-TRANSPORT-DOCS-001', explanation: 'Textul se referă la CMR; aplicabilitatea depinde de transportul contra cost, ruta internațională și statele relevante.', actions: ['Confirmă locul preluării, livrării și tipul operațiunii.', 'Verifică separat ADR, vama și dreptul național aplicabil.'] },
];

export function analyzeLegislationText(textInput: string, ocrConfidence: number): LegislationAnalysisResult {
  const text = textInput.normalize('NFC').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const rule = rules.find(({ pattern }) => pattern.test(text));
  const facts = extractFacts(text, rule?.label);
  const status = rule ? 'identified' : facts.length ? 'partial' : 'uncertain';
  return {
    context: 'legislation', status, topic: rule?.topic,
    summary: rule ? `${rule.label} — context juridic identificat.` : 'Contextul juridic nu poate fi identificat suficient de sigur.',
    facts,
    explanation: rule?.explanation ?? 'Textul confirmat nu conține suficiente repere pentru asocierea cu o regulă publicată.',
    recommendedActions: rule?.actions ?? ['Refă fotografia cu textul complet și lizibil.', 'Corectează OCR și solicită analiza din nou.'],
    warnings: ['Rezultatul este orientativ și nu reprezintă o decizie juridică sau calcul complet de conformitate.'],
    confidence: Math.max(0, Math.min(100, Math.round(Math.min(ocrConfidence, 86) * .68 + (rule ? 18 : 0) + Math.min(10, facts.length * 3)))),
    limitations: ['Sunt utilizate numai elementele din textul OCR confirmat.', 'Ruta, jurisdicția, perioada completă și excepțiile trebuie verificate separat.', 'Knowledge explică regula publicată; nu simulează analiza și nu înlocuiește sursa oficială.'],
    knowledgeReferences: rule ? [rule.reference] : [],
  };
}

export function formatLegislationResult(result: LegislationAnalysisResult) {
  return ['AGM Basic — Analiză Legislație', `Rezultat: ${result.summary}`, '', 'Date identificate:', ...(result.facts.length ? result.facts.map((fact) => `- ${fact.label}: ${fact.value}`) : ['- Date insuficiente']), '', `Explicație: ${result.explanation}`, '', 'Acțiuni recomandate:', ...result.recommendedActions.map((action) => `- ${action}`), '', `Referințe: ${result.knowledgeReferences.join(', ') || 'neidentificate'}`].join('\n');
}

function extractFacts(text: string, topic?: string) {
  const facts: LegislationFact[] = [];
  if (topic) facts.push({ label: 'Temă', value: topic, origin: 'ocr-confirmed' });
  const article = text.match(/art(?:icol)?\.?\s*(\d+[a-z]?)/i)?.[1];
  if (article) facts.push({ label: 'Articol menționat', value: article, origin: 'ocr-confirmed' });
  const values = [...text.matchAll(/\b(\d{1,2}(?:[,:.]\d{1,2})?\s*(?:h|hrs|ore|hours|stunden|min|mins|minute))\b/gi)].map((match) => match[1]);
  if (values.length) facts.push({ label: 'Valori menționate', value: [...new Set(values)].slice(0, 5).join(', '), origin: 'ocr-confirmed' });
  return facts;
}
