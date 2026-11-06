/**
 * Deterministic semantic index core shared by the AGMaTCC web client and the API.
 * Every text is projected into a fixed-size vector by feature hashing of (a) concept ids from a
 * closed RO/EN concept lexicon, (b) word stems and (c) character trigrams; ranking is cosine
 * similarity. No network, no external service, no randomness. It captures synonymy inside the
 * lexicon and morphological similarity; it is not a neural language model and does not
 * generalise beyond the lexicon.
 */
export const SEMANTIC_DIMENSIONS = 512;
export const SEMANTIC_INDEX_VERSION = 'agmatcc-semantic-hash-v1';
export const SEMANTIC_MIN_SCORE = 0.2;

const CONCEPTS: Record<string, readonly string[]> = {
  delay: ['intarziere', 'intarzieri', 'ratat', 'ratare', 'delay', 'late', 'asteptare', 'blocat', 'stationare', 'ramas'],
  incident: ['incident', 'incidente', 'avarie', 'defectiune', 'problema', 'probleme', 'accident', 'breakdown', 'failure', 'eroare', 'error'],
  alert: ['alerta', 'alerte', 'avertisment', 'avertizare', 'warning', 'alarm', 'alarma', 'semnal'],
  driver: ['sofer', 'soferi', 'conducator', 'driver', 'sofer', 'drivers'],
  vehicle: ['camion', 'camioane', 'vehicul', 'vehicule', 'truck', 'tir', 'autotren', 'remorca', 'trailer', 'vehicle'],
  route: ['ruta', 'rute', 'traseu', 'drum', 'route', 'itinerariu', 'navigatie'],
  toll: ['taxa', 'taxe', 'toll', 'tolls', 'peaj', 'rovinieta', 'vigneta'],
  customs: ['vama', 'vamal', 'customs', 'frontiera', 'border', 'granita'],
  cargo: ['marfa', 'incarcatura', 'cargo', 'load', 'transport', 'livrare', 'delivery', 'expeditie'],
  document: ['document', 'documente', 'cmr', 'factura', 'invoice', 'act', 'acte'],
  approval: ['aprobare', 'aprobat', 'approve', 'approved', 'approval', 'acord', 'validare', 'confirmare'],
  rejection: ['respins', 'respingere', 'reject', 'rejected', 'refuz', 'refuzat', 'veto', 'blocat'],
  release: ['release', 'lansare', 'publicare', 'deploy', 'deployment', 'versiune', 'version'],
  security: ['securitate', 'security', 'acces', 'autentificare', 'authentication', 'permisiune', 'permission', 'guardian'],
  risk: ['risc', 'riscuri', 'risk', 'pericol', 'amenintare', 'threat'],
  fuel: ['combustibil', 'motorina', 'fuel', 'carburant', 'diesel', 'consum'],
  rest: ['odihna', 'pauza', 'rest', 'tahograf', 'tachograph', 'repaus'],
};

const conceptByTerm = new Map<string, string>();
for (const [concept, terms] of Object.entries(CONCEPTS)) for (const term of terms) conceptByTerm.set(term, concept);

export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function stem(word: string): string {
  return word.length > 5 ? word.slice(0, 5) : word;
}

function add(vector: Float64Array, feature: string, weight: number) {
  const hash = fnv1a(feature);
  vector[hash % SEMANTIC_DIMENSIONS] += (hash & 0x80000000) === 0 ? weight : -weight;
}

export function embedText(text: string): Float64Array {
  const vector = new Float64Array(SEMANTIC_DIMENSIONS);
  const words = foldText(text).split(' ').filter((word) => word.length > 1);
  for (const word of words) {
    const concept = conceptByTerm.get(word);
    if (concept) add(vector, `c:${concept}`, 3);
    add(vector, `s:${stem(word)}`, 1.5);
    const padded = `^${word}$`;
    for (let i = 0; i + 3 <= padded.length; i += 1) add(vector, `t:${padded.slice(i, i + 3)}`, 0.4);
  }
  return vector;
}

export function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export function queryConceptSet(query: string): Set<string> {
  return new Set(foldText(query).split(' ').map((word) => conceptByTerm.get(word)).filter((c): c is string => Boolean(c)));
}

export function matchedConcepts(text: string, queryConcepts: ReadonlySet<string>): string[] {
  return [...new Set(foldText(text).split(' ').map((word) => conceptByTerm.get(word)).filter((c): c is string => Boolean(c) && queryConcepts.has(c as string)))];
}
