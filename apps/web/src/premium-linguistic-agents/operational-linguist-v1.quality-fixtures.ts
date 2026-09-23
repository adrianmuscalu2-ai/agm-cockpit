import type { OperationalLinguistV1Language } from '@agm/shared';

export const operationalLinguistV1QualityCategories = [
  'ordinary', 'colloquial', 'idiom', 'contextual-ambiguity', 'culturally-natural', 'transport',
  'automotive', 'address', 'numbers', 'vin', 'protected-terms', 'register-tone',
] as const;

export type OperationalLinguistV1QualityCategory = (typeof operationalLinguistV1QualityCategories)[number];
export type OperationalLinguistV1QualityVerdict = 'PASS' | 'REVIEW_REQUIRED';

type Fixture = {
  id: string;
  category: OperationalLinguistV1QualityCategory;
  source: string;
  context: string;
  expected: Readonly<Record<OperationalLinguistV1Language, readonly string[]>>;
  protectedTerms?: readonly string[];
};

export const operationalLinguistV1QualityFixtures: readonly Fixture[] = Object.freeze([
  fixture('ordinary-arrival', 'ordinary', 'Șoferul ajunge la ora opt.', 'Neutral operational update.', 'L’autista arriva alle otto.', 'El conductor llega a las ocho.', 'Föraren kommer klockan åtta.'),
  fixture('colloquial-on-way', 'colloquial', 'Ajung imediat, sunt pe drum.', 'Informal driver message.', 'Arrivo subito, sono per strada.', 'Llego enseguida, estoy de camino.', 'Jag är framme snart, jag är på väg.'),
  fixture('idiom-forget-it', 'idiom', 'Mi-a zis să-mi pun pofta-n cui.', 'The intent is “accept that it will not happen”; never translate word by word.', 'Mi ha detto di scordarmelo.', 'Me dijo que me olvidara.', 'Han sa att jag kunde glömma det.'),
  fixture('context-key-gate', 'contextual-ambiguity', 'Am lăsat cheia la poartă.', 'Physical key left at the entrance gate.', 'Ho lasciato la chiave al cancello.', 'He dejado la llave en la puerta de entrada.', 'Jag lämnade nyckeln vid grinden.'),
  fixture('natural-good-trip', 'culturally-natural', 'Drum bun!', 'Natural farewell to a driver.', 'Buon viaggio!', '¡Buen viaje!', 'Trevlig resa!'),
  fixture('transport-cmr', 'transport', 'CMR-ul trebuie semnat la livrare.', 'International road freight document.', 'La CMR deve essere firmata alla consegna.', 'La carta de porte CMR debe firmarse en la entrega.', 'CMR-fraktsedeln måste undertecknas vid leveransen.', ['CMR']),
  fixture('automotive-brake', 'automotive', 'Martorul sistemului de frânare este aprins.', 'Vehicle dashboard warning.', 'La spia dell’impianto frenante è accesa.', 'El testigo del sistema de frenos está encendido.', 'Varningslampan för bromssystemet lyser.'),
  fixture('address-preservation', 'address', 'Preluare: Staufenbergstraße 72, 74081 Heilbronn.', 'Preserve the exact address.', 'Ritiro: Staufenbergstraße 72, 74081 Heilbronn.', 'Recogida: Staufenbergstraße 72, 74081 Heilbronn.', 'Hämtning: Staufenbergstraße 72, 74081 Heilbronn.', ['Staufenbergstraße 72', '74081 Heilbronn']),
  fixture('number-preservation', 'numbers', 'Greutate: 1.250 kg; sosire: 14:30.', 'Preserve numerical values and time.', 'Peso: 1.250 kg; arrivo: 14:30.', 'Peso: 1.250 kg; llegada: 14:30.', 'Vikt: 1.250 kg; ankomst: 14:30.', ['1.250 kg', '14:30']),
  fixture('vin-preservation', 'vin', 'Verifică VIN WDB12345678901234.', 'VIN is immutable.', 'Verifica il VIN WDB12345678901234.', 'Comprueba el VIN WDB12345678901234.', 'Kontrollera VIN WDB12345678901234.', ['VIN', 'WDB12345678901234']),
  fixture('protected-terms', 'protected-terms', 'AGM Car Mover confirmă comanda TomTom.', 'Product and provider names are immutable.', 'AGM Car Mover conferma il comando TomTom.', 'AGM Car Mover confirma la orden de TomTom.', 'AGM Car Mover bekräftar TomTom-kommandot.', ['AGM Car Mover', 'TomTom']),
  fixture('formal-tone', 'register-tone', 'Vă rugăm să confirmați ora de descărcare.', 'Polite formal request.', 'La preghiamo di confermare l’orario di scarico.', 'Le rogamos que confirme la hora de descarga.', 'Vänligen bekräfta lossningstiden.'),
]);

export function assessOperationalLinguistV1QualityCandidate(
  fixtureId: string,
  language: OperationalLinguistV1Language,
  candidate: string,
): OperationalLinguistV1QualityVerdict {
  const fixtureValue = operationalLinguistV1QualityFixtures.find((fixtureValue) => fixtureValue.id === fixtureId);
  if (!fixtureValue) return 'REVIEW_REQUIRED';
  const normalizedCandidate = normalizeCandidate(candidate);
  return fixtureValue.expected[language].some((accepted) => normalizeCandidate(accepted) === normalizedCandidate)
    ? 'PASS'
    : 'REVIEW_REQUIRED';
}

function fixture(
  id: string,
  category: OperationalLinguistV1QualityCategory,
  source: string,
  context: string,
  it: string,
  es: string,
  sv: string,
  protectedTerms: readonly string[] = [],
): Fixture {
  return Object.freeze({ id, category, source, context, expected: Object.freeze({ it: Object.freeze([it]), es: Object.freeze([es]), sv: Object.freeze([sv]) }), protectedTerms: Object.freeze([...protectedTerms]) });
}

function normalizeCandidate(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}
