export type CargoSafetyAnalysisResult = {
  context: 'cargo-safety';
  status: 'identified' | 'partial' | 'uncertain';
  topic?: string;
  summary: string;
  facts: Array<{ label: string; value: string; origin: 'ocr-confirmed' }>;
  explanation: string;
  recommendedActions: string[];
  warnings: string[];
  confidence: number;
  limitations: string[];
  knowledgeReferences: Array<'KB-LEGAL-CARGO-SECURING-001'>;
};

const rules = [
  { topic: 'Echipament, LC, STF și SHF', pattern: /EN\s*12195-2|\b(?:LC|STF|SHF)\b|etichet.{0,25}(?:ching|strap|zurr)|\bdaN\b/i, explanation: 'Textul indică date ale echipamentului de ancorare. LC, STF și SHF au roluri diferite și nicio valoare izolată nu stabilește automat numărul de chingi.', actions: ['Compară toate valorile cu eticheta originală.', 'Verifică metoda, uzura, tăieturile, nodurile, muchiile și punctele de ancorare.', 'Folosește planul sau calculul aplicabil înainte de plecare.'] },
  { topic: 'Mărfuri periculoase — ADR', pattern: /\bADR\b|UN\s*\d{4}|dangerous goods|gefahrgut|marf.{0,12}periculo/i, explanation: 'Textul indică o posibilă încărcătură ADR. Cerințele ADR, inclusiv regulile de manipulare și fixare aplicabile transportului concret, se verifică separat.', actions: ['Confirmă numărul UN, documentele și clasa din sursa originală.', 'Nu aplica numai regulile generale de ancorare.', 'Solicită verificarea ADR și instrucțiunile transportatorului.'] },
  { topic: 'Deficiență la securizarea încărcăturii', pattern: /(?:ching|strap|zurr).{0,30}(?:rupt|tăiat|taiat|defect|damage)|(?:punct|anchor).{0,25}(?:defect|damage)|încărcătur.{0,25}(?:deplas|liber)|ladung.{0,25}(?:verschoben|lose)/i, explanation: 'Textul descrie o posibilă deficiență a echipamentului sau o deplasare a încărcăturii. Fotografia și OCR-ul nu stabilesc singure clasa juridică a deficienței.', actions: ['Nu porni și nu continua până la o verificare sigură.', 'Scoate echipamentul defect din uz și cere remedierea conform planului.', 'Dacă situația a apărut în mers, oprește într-un loc sigur și escaladează.'] },
  { topic: 'Germania — §22 StVO', pattern: /§\s*22|StVO|vollbremsung|ausweichbewegung/i, explanation: 'Textul indică regula germană privind fixarea mărfii și echipamentelor pentru frânare completă ori evitare bruscă. Regula nu trebuie extrapolată automat întregului traseu.', actions: ['Confirmă că segmentul relevant este în Germania.', 'Verifică și cerințele celorlalte jurisdicții de pe traseu.', 'Aplică regulile tehnice și planul de încărcare relevante.'] },
  { topic: 'Forțe de proiectare', pattern: /0[,.]8|0[,.]5|forț.{0,20}(?:înainte|lateral|înapoi)|forward.{0,20}lateral/i, explanation: 'Valorile pot descrie reperele de proiectare pentru deplasarea încărcăturii. Ele nu se transformă direct într-un număr de chingi.', actions: ['Confirmă masa, geometria, frecarea și direcțiile de calcul.', 'Folosește metoda de calcul sau planul aplicabil.'] },
  { topic: 'Distribuție și sarcini pe axe', pattern: /sarcin.{0,20}ax|axle load|achslast|centru.{0,15}greutate/i, explanation: 'Textul privește distribuția masei și sarcinile pe axe; masa totală singură nu confirmă distribuția sigură.', actions: ['Verifică masa și centrul de greutate.', 'Compară sarcinile pe axe cu planul și limitele autorizate.'] },
  { topic: 'Metodă de fixare', pattern: /ancorare direct|peste încărcătur|blocare|direct lashing|tie-down|formschl|niederzurr/i, explanation: 'Textul indică o metodă de fixare. Suficiența ei depinde de datele complete ale încărcăturii, vehiculului, frecării, unghiurilor și echipamentului.', actions: ['Confirmă metoda din planul de încărcare.', 'Verifică punctele, unghiurile, etichetele și eventualele goluri.'] },
  { topic: 'Reverificare după eveniment', pattern: /frânare puternic|hard brak|vollbrems|reverific|recheck|nachkontroll/i, explanation: 'Textul indică necesitatea unei reverificări după un eveniment care poate modifica încărcătura.', actions: ['Oprește într-un loc sigur.', 'Inspectează încărcătura și toate mijloacele de fixare înainte de continuare.'] },
] as const;

export function analyzeCargoSafetyText(textInput: string, ocrConfidence: number): CargoSafetyAnalysisResult {
  const text = textInput.normalize('NFC').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const rule = rules.find(({ pattern }) => pattern.test(text));
  const facts: CargoSafetyAnalysisResult['facts'] = [];
  if (rule) facts.push({ label: 'Temă', value: rule.topic, origin: 'ocr-confirmed' });
  const standard = text.match(/\bEN\s*12195-2\b/i)?.[0];
  if (standard) facts.push({ label: 'Standard menționat', value: standard, origin: 'ocr-confirmed' });
  const labels = [...text.matchAll(/\b(?:LC|STF|SHF)\s*[:=]?\s*(\d{2,5})\s*(daN|kN)?/gi)].map((match) => match[0]);
  if (labels.length) facts.push({ label: 'Valori etichetă', value: [...new Set(labels)].slice(0, 6).join(', '), origin: 'ocr-confirmed' });
  if (/(?:not\s+for\s+lifting|nicht.{0,20}heben|darf\s+nicht.{0,20}heben|nu.{0,20}ridicare)/i.test(text)) {
    facts.push({ label: 'Avertisment utilizare', value: 'Nu este destinat ridicării', origin: 'ocr-confirmed' });
  }
  const un = text.match(/\bUN\s*(\d{4})\b/i)?.[0];
  if (un) facts.push({ label: 'Număr UN menționat', value: un, origin: 'ocr-confirmed' });
  return {
    context: 'cargo-safety',
    status: rule ? 'identified' : text.length >= 18 ? 'partial' : 'uncertain',
    topic: rule?.topic,
    summary: rule ? `${rule.topic} — context identificat.` : 'Date insuficiente pentru evaluarea siguranței încărcăturii.',
    facts,
    explanation: rule?.explanation ?? 'Textul confirmat nu conține suficiente repere pentru asocierea sigură cu o regulă publicată.',
    recommendedActions: rule?.actions ? [...rule.actions] : ['Refă fotografia astfel încât etichetele și instrucțiunile să fie lizibile.', 'Corectează textul OCR și repetă analiza.', 'Cere planul de încărcare sau verificarea unui specialist.'],
    warnings: ['Nu porni pe baza acestui rezultat: sunt necesare inspecția fizică și planul sau calculul aplicabil.'],
    confidence: Math.max(0, Math.min(100, Math.round(Math.min(ocrConfidence, 86) * .66 + (rule ? 18 : 0) + Math.min(10, facts.length * 4)))),
    limitations: ['Sunt analizate numai informațiile din textul OCR confirmat, nu geometria sau starea vizuală a încărcăturii.', 'Rezultatul nu calculează numărul de chingi și nu certifică securizarea.', 'Jurisdicția, ADR, masa, frecarea, unghiurile, axele și capacitatea punctelor se verifică separat.'],
    knowledgeReferences: rule ? ['KB-LEGAL-CARGO-SECURING-001'] : [],
  };
}

export function formatCargoSafetyResult(result: CargoSafetyAnalysisResult) {
  return ['AGM Basic — Siguranța încărcăturii', `Rezultat: ${result.summary}`, '', 'Date identificate:', ...(result.facts.length ? result.facts.map((fact) => `- ${fact.label}: ${fact.value}`) : ['- Date insuficiente']), '', `Explicație: ${result.explanation}`, '', 'Acțiuni recomandate:', ...result.recommendedActions.map((action) => `- ${action}`), '', `Referință: ${result.knowledgeReferences.join(', ') || 'neidentificată'}`].join('\n');
}
