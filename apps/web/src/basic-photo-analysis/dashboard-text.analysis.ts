export type DashboardMessageCategory =
  | 'stop-critical'
  | 'brake-system'
  | 'abs'
  | 'oil-pressure'
  | 'coolant-temperature'
  | 'charging-system'
  | 'engine-system'
  | 'fuel-level'
  | 'adblue-level'
  | 'particle-filter';

export type DashboardTextFact = {
  label: string;
  value: string;
  origin: 'ocr-confirmed';
};

export type DashboardTextAnalysisResult = {
  context: 'dashboard-text';
  status: 'identified' | 'partial' | 'uncertain';
  category?: DashboardMessageCategory;
  summary: string;
  facts: DashboardTextFact[];
  explanation: string;
  recommendedActions: string[];
  warnings: string[];
  confidence: number;
  limitations: string[];
  knowledgeReferences: ['KB-VEHICLE-WARN-001'];
};

type MessageDefinition = {
  category: DashboardMessageCategory;
  label: string;
  pattern: RegExp;
  explanation: string;
  actions: string[];
};

const definitions: readonly MessageDefinition[] = [
  {
    category: 'brake-system',
    label: 'Mesaj STOP - sistem de frânare',
    pattern: /(?=[\s\S]*\bstop\b)(?=[\s\S]*(?:fr[aâ]n|bra(?:k|ck)(?:e|ing)|bremse|bremsanlage))[\s\S]*/i,
    explanation: 'Textul confirmat conține atât instrucțiunea STOP, cât și o defecțiune a sistemului de frânare; textul singur nu identifică piesa defectă.',
    actions: ['Păstrează controlul și oprește într-un loc sigur.', 'Nu continua deplasarea fără verificarea mesajului complet și procedura exactă a vehiculului.', 'Solicită asistență dacă mesajul persistă sau frânarea este anormală.'],
  },
  {
    category: 'stop-critical',
    label: 'Mesaj STOP / oprire',
    pattern: /\b(?:stop|opr(?:iți|ire|ește)|anhalten|sofort anhalten)\b/i,
    explanation: 'Textul confirmat solicită oprirea sau indică un mesaj STOP; cauza exactă trebuie citită integral pe afișaj.',
    actions: ['Păstrează controlul și oprește într-un loc sigur.', 'Citește mesajul complet și nu continua fără procedura exactă a vehiculului.'],
  },
  {
    category: 'brake-system',
    label: 'Mesaj sistem de frânare',
    pattern: /(?:frân|fran|bra(?:k|ck)(?:e|ing)|bremse|bremsanlage|presiune.{0,20}aer|air pressure)/i,
    explanation: 'Mesajul se referă la frânare sau la presiunea sistemului; textul singur nu stabilește componenta defectă.',
    actions: ['Redu controlat și verifică mesajul complet.', 'Dacă frânarea este anormală sau mesajul persistă, oprește în siguranță și solicită asistență.'],
  },
  {
    category: 'abs',
    label: 'Mesaj ABS',
    pattern: /\babs\b|antiblocare|anti-lock/i,
    explanation: 'Mesajul indică o posibilă limitare sau defecțiune ABS; frânarea de bază are statut separat.',
    actions: ['Mărește distanța și evită manevrele bruște.', 'Verifică dacă mesajul privește tractorul sau remorca și urmează manualul.'],
  },
  {
    category: 'oil-pressure',
    label: 'Mesaj presiune ulei motor',
    pattern: /(?:presiune|pressure|druck).{0,24}(?:ulei|oil|öl)|(?:ulei|oil|öl).{0,24}(?:scăzut|low|niedrig|pressure|druck)/i,
    explanation: 'Mesajul indică presiunea uleiului; nivelul și presiunea nu sunt același lucru.',
    actions: ['Oprește ținând cont de trafic și oprește motorul în siguranță.', 'Urmează procedura exactă din manual și solicită atelier dacă mesajul persistă.'],
  },
  {
    category: 'coolant-temperature',
    label: 'Mesaj temperatură lichid de răcire',
    pattern: /(?:temperatur|temperature).{0,30}(?:lichid|coolant|motor|engine|kühl)|(?:coolant|kühlmittel).{0,20}(?:hot|high|heiß|temperatur)/i,
    explanation: 'Mesajul se referă la temperatura motorului sau a lichidului de răcire.',
    actions: ['Redu sarcina și oprește în siguranță conform mesajului.', 'Nu deschide sistemul fierbinte sub presiune.'],
  },
  {
    category: 'charging-system',
    label: 'Mesaj încărcare / alternator',
    pattern: /alternator|generator|(?:baterie|battery|batterie).{0,24}(?:încărc|incarc|charge|ladung|defect|fault)/i,
    explanation: 'Mesajul indică o problemă posibilă a sistemului de încărcare, nu doar starea bateriei.',
    actions: ['Citește mesajele electrice asociate.', 'Oprește controlat într-un loc sigur și solicită verificare dacă mesajul persistă.'],
  },
  {
    category: 'engine-system',
    label: 'Mesaj sistem motor',
    pattern: /(?:motor|engine).{0,30}(?:defect|fault|malfunction|eroare|error|störung)|check engine/i,
    explanation: 'Mesajul indică o problemă legată de motor sau emisii; severitatea exactă depinde de textul complet și comportamentul vehiculului.',
    actions: ['Evită sarcina mare și citește mesajul complet.', 'La fum, zgomot, pierdere de putere sau solicitare de oprire, oprește sigur și cere asistență.'],
  },
  {
    category: 'fuel-level',
    label: 'Mesaj nivel combustibil',
    pattern: /(?:combustibil|fuel|kraftstoff).{0,24}(?:redus|low|reserve|rezerv|niedrig)/i,
    explanation: 'Mesajul indică nivel redus de combustibil; autonomia afișată nu este o garanție.',
    actions: ['Planifică alimentarea sigură cât mai curând.', 'Nu opri și nu devia într-un mod riscant.'],
  },
  {
    category: 'adblue-level',
    label: 'Mesaj AdBlue / AUS 32',
    pattern: /adblue|aus\s*32|reductant/i,
    explanation: 'Mesajul se referă la soluția sistemului SCR; pragurile și limitările sunt specifice vehiculului.',
    actions: ['Citește mesajul complet și completează numai cu produs conform specificației.', 'Respectă termenul sau distanța afișată de vehicul.'],
  },
  {
    category: 'particle-filter',
    label: 'Mesaj filtru de particule / regenerare',
    pattern: /(?:filtru.{0,20}particule|particle filter|partikelfilter|\bdpf\b|regenerare|regeneration)/i,
    explanation: 'Mesajul indică filtrul de particule ori o cerere de regenerare; procedura permisă este specifică vehiculului.',
    actions: ['Urmează exact procedura vehiculului într-un loc permis și sigur.', 'Nu iniția regenerarea lângă materiale combustibile.'],
  },
];

export function analyzeDashboardText(confirmedText: string, ocrConfidence: number): DashboardTextAnalysisResult {
  const text = normalize(confirmedText);
  const detected = definitions.find(({ pattern }) => pattern.test(text));
  const facts = extractFacts(text, detected?.label);
  const status = detected ? 'identified' : facts.length ? 'partial' : 'uncertain';
  const confidence = Math.max(0, Math.min(100, Math.round(
    Math.min(ocrConfidence, 86) * 0.68 + (detected ? 18 : 0) + Math.min(10, facts.length * 3),
  )));

  return {
    context: 'dashboard-text',
    status,
    category: detected?.category,
    summary: detected ? `${detected.label} — context identificat.` : 'Mesajul din bord nu poate fi identificat suficient de sigur.',
    facts,
    explanation: detected?.explanation ?? 'Textul confirmat nu conține suficiente repere pentru o explicație contextuală sigură.',
    recommendedActions: detected?.actions ?? [
      'Refă fotografia concentrând cadrul pe mesajul textual complet.',
      'Corectează textul OCR și rulează din nou analiza.',
    ],
    warnings: warningsFor(text, status),
    confidence,
    limitations: [
      'Rezultatul folosește exclusiv textul OCR confirmat de utilizator.',
      'AGM nu identifică simbolul vizual și nu stabilește severitatea dacă aceasta nu este explicită în text.',
      'Mesajul complet și manualul exact al vehiculului au prioritate.',
    ],
    knowledgeReferences: ['KB-VEHICLE-WARN-001'],
  };
}

export function formatDashboardTextResult(result: DashboardTextAnalysisResult) {
  return [
    'AGM Basic — Analiză mesaj textual din bord',
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
    'Referință: KB-VEHICLE-WARN-001',
  ].join('\n');
}

function extractFacts(text: string, categoryLabel?: string) {
  const facts: DashboardTextFact[] = [];
  if (categoryLabel) facts.push(fact('Categorie mesaj', categoryLabel));
  const code = text.match(/(?:cod|code|fehlercode|error(?:\s+code)?)[\s:.-]*([a-z0-9-]{2,16})/i)?.[1];
  if (code) facts.push(fact('Cod afișat', code.toUpperCase()));
  const instruction = text.match(/\b(stop|opriți|oprire|anhalten|service|atelier|workshop|werkstatt)\b/i)?.[1];
  if (instruction) facts.push(fact('Instrucțiune explicită', instruction));
  const color = text.match(/\b(roșu|rosu|red|rot|galben|yellow|gelb)\b/i)?.[1];
  if (color) facts.push(fact('Culoare menționată', color));
  return facts;
}

function warningsFor(text: string, status: DashboardTextAnalysisResult['status']) {
  const warnings: string[] = [];
  if (status !== 'identified') warnings.push('Nu lua o decizie numai pe baza acestui rezultat; este necesar mesajul complet.');
  if (/\b(stop|opriți|oprire|anhalten|sofort|imediat|immediately)\b/i.test(text)) {
    warnings.push('Textul conține o instrucțiune de oprire sau acțiune imediată; nu o ignora.');
  }
  return warnings;
}

function normalize(value: string) {
  return value.normalize('NFC').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function fact(label: string, value: string): DashboardTextFact {
  return { label, value: value.trim().slice(0, 100), origin: 'ocr-confirmed' };
}
