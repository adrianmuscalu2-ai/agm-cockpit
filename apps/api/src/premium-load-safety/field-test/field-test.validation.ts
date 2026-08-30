import type {
  FieldPhotoRole,
  FieldReportItem,
  FieldTestInput,
  FieldTestReport,
} from './field-test.types';

const requiredRoles: FieldPhotoRole[] = ['front-oblique', 'rear-oblique'];
const allowedRoles = new Set<FieldPhotoRole>([...requiredRoles, 'opposite-side', 'strap-label', 'anchor-point', 'cargo-detail']);
const sources = new Set(['photo', 'confirmed-ocr', 'user-declared', 'unknown']);
const certainties = new Set(['observed', 'probable', 'undetermined']);

export function parseFieldRoles(value: string | undefined, fileCount: number) {
  const parsed = value ? JSON.parse(value) : [];
  if (!Array.isArray(parsed) || parsed.length !== fileCount || !parsed.every((role) => allowedRoles.has(role))) {
    throw new Error('Invalid field photo roles.');
  }
  if (!requiredRoles.every((role) => parsed.includes(role)) || new Set(parsed).size !== parsed.length) {
    throw new Error('Two unique required lateral field views are required.');
  }
  return parsed as FieldPhotoRole[];
}

export function parseFieldInput(value: string | undefined): FieldTestInput {
  const parsed = value ? JSON.parse(value) as Record<string, unknown> : {};
  const ocrConfirmed = parsed.ocrConfirmed === true;
  return {
    weightKg: positive(parsed.weightKg, 200_000),
    cargoType: text(parsed.cargoType, 120),
    antiSlipMats: choice(parsed.antiSlipMats),
    edgeProtectors: choice(parsed.edgeProtectors),
    frontSupported: choice(parsed.frontSupported),
    oppositeSide: oppositeSideChoice(parsed.oppositeSide),
    confirmedLcDan: ocrConfirmed ? positive(parsed.confirmedLcDan, 50_000) : undefined,
    confirmedStfDan: ocrConfirmed ? positive(parsed.confirmedStfDan, 10_000) : undefined,
    ocrConfirmed,
  };
}

export function parseFieldReport(value: string | undefined): FieldTestReport | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<FieldTestReport>;
    if (!validItems(parsed.observations) || !validItems(parsed.visibleRisks) || !validItems(parsed.recommendations) || !validItems(parsed.missingInformation) || !validItems(parsed.conflicts)) {
      return undefined;
    }
    return {
      observations: parsed.observations.map(clean),
      visibleRisks: parsed.visibleRisks.map(clean),
      recommendations: parsed.recommendations.map(clean),
      missingInformation: parsed.missingInformation.map(clean),
      conflicts: parsed.conflicts.map(clean),
    };
  } catch {
    return undefined;
  }
}

export function finalizeFieldReport(
  report: FieldTestReport,
  input: FieldTestInput,
  language: string,
): FieldTestReport {
  const normalized = {
    observations: withoutAiOcr(report.observations).map(removeUnsupportedPhotoRoles),
    visibleRisks: withoutAiOcr(report.visibleRisks).map(removeUnsupportedPhotoRoles),
    recommendations: withoutAiOcr(report.recommendations).map(removeUnsupportedPhotoRoles),
    missingInformation: withoutAiOcr(report.missingInformation).map(removeUnsupportedPhotoRoles),
    conflicts: withoutAiOcr(report.conflicts).map(removeUnsupportedPhotoRoles),
  };
  if (
    input.ocrConfirmed &&
    (input.confirmedLcDan !== undefined || input.confirmedStfDan !== undefined)
  ) {
    normalized.observations.push(confirmedOcrItem(input, language));
  }
  if (input.oppositeSide === 'confirmed-symmetric') {
    normalized.observations.push(oppositeSideConfirmation(language));
  } else if (input.oppositeSide !== 'visible') {
    normalized.missingInformation.push(oppositeSideWarning(language));
  }
  return normalized;
}

function withoutAiOcr(items: FieldReportItem[]) {
  return items.filter((item) => !item.sources.includes('confirmed-ocr'));
}

function validItems(value: unknown): value is FieldReportItem[] {
  return Array.isArray(value) && value.length <= 24 && value.every((item) =>
    item && typeof item === 'object' &&
    typeof item.id === 'string' && typeof item.statement === 'string' && typeof item.explanation === 'string' &&
    certainties.has(item.certainty) && Array.isArray(item.sources) && item.sources.length > 0 &&
    item.sources.every((source: unknown) => sources.has(source as string)) &&
    Array.isArray(item.photoRoles) && item.photoRoles.every((role: unknown) => allowedRoles.has(role as FieldPhotoRole)));
}

function clean(item: FieldReportItem): FieldReportItem {
  const itemSources = [...new Set(item.sources)];
  const photoRoles = [...new Set(item.photoRoles)];
  let certainty = item.certainty;
  if (
    certainty === 'observed' &&
    (!itemSources.includes('photo') || itemSources.some((source) => source !== 'photo') || photoRoles.length === 0)
  ) certainty = 'probable';
  return {
    id: item.id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80),
    statement: normalize(item.statement),
    certainty,
    sources: itemSources,
    explanation: normalize(item.explanation),
    photoRoles,
  };
}

function removeUnsupportedPhotoRoles(item: FieldReportItem): FieldReportItem {
  return item.sources.includes('photo') ? item : { ...item, photoRoles: [] };
}

function confirmedOcrItem(input: FieldTestInput, language: string): FieldReportItem {
  const values = [
    input.confirmedLcDan !== undefined ? `LC ${input.confirmedLcDan} daN` : '',
    input.confirmedStfDan !== undefined ? `STF ${input.confirmedStfDan} daN` : '',
  ].filter(Boolean).join(', ');
  const copy = language === 'de'
    ? {
        statement: `Bestätigte Etikettwerte: ${values}.`,
        explanation: 'LC ist die Zurrkraft und STF die Standardvorspannkraft. Diese Etikettwerte stammen aus der lokalen Texterkennung und wurden vom Fahrer geprüft oder korrigiert.',
      }
    : language === 'en'
      ? {
          statement: `Confirmed label values: ${values}.`,
          explanation: 'LC is the lashing capacity and STF is the standard tension force. These label values came from local text recognition and were checked or corrected by the driver.',
        }
      : language === 'it' ? { statement:`Valori confermati dell’etichetta: ${values}.`,explanation:'LC è la capacità di ancoraggio e STF la forza di pretensionamento standard. Questi valori provengono dal riconoscimento locale del testo e sono stati controllati o corretti dal conducente.' }
      : language === 'es' ? { statement:`Valores confirmados de la etiqueta: ${values}.`,explanation:'LC es la capacidad de amarre y STF la fuerza de pretensado estándar. Estos valores proceden del reconocimiento local de texto y fueron revisados o corregidos por el conductor.' }
      : language === 'sv' ? { statement:`Bekräftade etikettvärden: ${values}.`,explanation:'LC är surrningskapaciteten och STF den standardiserade förspänningskraften. Värdena kommer från lokal textigenkänning och har kontrollerats eller korrigerats av föraren.' }
      : {
          statement: `Valori confirmate de pe etichetă: ${values}.`,
          explanation: 'LC reprezintă capacitatea de ancorare, iar STF reprezintă forța standard de tensionare. Valorile provin din recunoașterea locală și au fost verificate sau corectate de șofer.',
        };
  return {
    id: 'confirmed-strap-label-values',
    statement: copy.statement,
    certainty: 'probable',
    sources: ['confirmed-ocr'],
    explanation: copy.explanation,
    photoRoles: [],
  };
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 700);
}

function positive(value: unknown, maximum: number) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maximum) throw new Error('Invalid field numeric input.');
  return parsed;
}

function text(value: unknown, maximum: number) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('Invalid field text input.');
  const normalized = normalize(value);
  if (!normalized || normalized.length > maximum) throw new Error('Invalid field text input.');
  return normalized;
}

function choice(value: unknown): 'yes' | 'no' | 'unknown' {
  return value === 'yes' || value === 'no' ? value : 'unknown';
}

function oppositeSideChoice(value: unknown): FieldTestInput['oppositeSide'] {
  return value === 'visible' || value === 'not-visible' || value === 'confirmed-symmetric' ? value : 'unknown';
}

function oppositeSideWarning(language: string): FieldReportItem {
  const copy = language === 'de'
    ? {
        statement: 'Die gegenüberliegende Seite ist nicht sichtbar. Die Analyse dieses Bereichs stützt sich auf die verfügbaren Informationen und kann unvollständig sein.',
        explanation: 'AGM überträgt sichtbare Merkmale nicht automatisch auf einen verdeckten Bereich. Für diese Seite fehlt eine direkte visuelle Bestätigung.',
      }
    : language === 'en'
      ? {
          statement: 'The opposite side is not visible. Analysis of this area is based on the available information and may be incomplete.',
          explanation: 'AGM does not automatically extend visible features to a hidden area. There is no direct visual confirmation for this side.',
        }
      : language === 'it' ? { statement:'Il lato opposto non è visibile. L’analisi di questa area si basa sulle informazioni disponibili e potrebbe essere incompleta.',explanation:'AGM non estende automaticamente le caratteristiche visibili a un’area nascosta. Non esiste una conferma visiva diretta per questo lato.' }
      : language === 'es' ? { statement:'El lado opuesto no es visible. El análisis de esta zona se basa en la información disponible y puede estar incompleto.',explanation:'AGM no extiende automáticamente las características visibles a una zona oculta. No hay confirmación visual directa de este lado.' }
      : language === 'sv' ? { statement:'Den motsatta sidan är inte synlig. Analysen av området bygger på tillgänglig information och kan vara ofullständig.',explanation:'AGM överför inte automatiskt synliga egenskaper till ett dolt område. Det finns ingen direkt visuell bekräftelse för den här sidan.' }
      : {
          statement: 'Partea opusă nu este vizibilă. Analiza acestei zone se bazează pe informațiile disponibile și poate fi incompletă.',
          explanation: 'AGM nu presupune că o zonă ascunsă este identică cu partea vizibilă. Pentru această parte lipsește confirmarea vizuală directă.',
        };
  return {
    id: 'opposite-side-not-visible',
    statement: copy.statement,
    certainty: 'undetermined',
    sources: ['unknown'],
    explanation: copy.explanation,
    photoRoles: [],
  };
}

function oppositeSideConfirmation(language: string): FieldReportItem {
  if (language === 'it' || language === 'es' || language === 'sv') {
    const copy = {
      it: { statement:'Il conducente conferma che il lato opposto è identico o simmetrico.', explanation:'Questa informazione proviene dalla dichiarazione esplicita del conducente e non è un’osservazione visiva di AGM.' },
      es: { statement:'El conductor confirma que el lado opuesto es idéntico o simétrico.', explanation:'Esta información procede de la declaración explícita del conductor y no es una observación visual de AGM.' },
      sv: { statement:'Föraren bekräftar att den motsatta sidan är identisk eller symmetrisk.', explanation:'Informationen kommer från förarens uttryckliga uppgift och är inte en visuell observation från AGM.' },
    }[language];
    return { id:'opposite-side-driver-confirmation', statement:copy.statement, certainty:'probable', sources:['user-declared'], explanation:copy.explanation, photoRoles:[] };
  }
  const copy = language === 'de'
    ? {
        statement: 'Der Fahrer bestätigt, dass die gegenüberliegende Seite identisch oder symmetrisch ist.',
        explanation: 'Diese Information stammt aus der ausdrücklichen Angabe des Fahrers und ist keine visuelle Beobachtung von AGM.',
      }
    : language === 'en'
      ? {
          statement: 'The driver confirms that the opposite side is identical or symmetrical.',
          explanation: 'This information comes from the driver’s explicit declaration and is not an AGM visual observation.',
        }
      : {
          statement: 'Șoferul confirmă că partea opusă este identică sau simetrică.',
          explanation: 'Informația provine din declarația explicită a șoferului și nu reprezintă o observație vizuală AGM.',
        };
  return {
    id: 'opposite-side-driver-confirmation',
    statement: copy.statement,
    certainty: 'probable',
    sources: ['user-declared'],
    explanation: copy.explanation,
    photoRoles: [],
  };
}
