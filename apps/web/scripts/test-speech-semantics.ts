import assert from 'node:assert/strict';
import { basicLanguageCodes } from '../src/language-registry';
import { normalizeSpeechText, speechTokenPolicy } from '../src/speech-semantics';

const exact: Array<[string, string, string]> = [
  ['ro', '30 km', '30 de kilometri'], ['de', '30 km', '30 Kilometer'], ['en', '30 km', '30 kilometers'],
  ['ro', '30 °C', '30 de grade Celsius'], ['de', '30 °C', '30 Grad Celsius'], ['en', '30 °C', '30 degrees Celsius'],
  ['ro', '80 km/h', '80 de kilometri pe oră'], ['de', '80 km/h', '80 Kilometer pro Stunde'], ['en', '80 km/h', '80 kilometers per hour'],
  ['ro', '20 t', '20 de tone'], ['ro', '24 V', '24 de volți'], ['ro', '150 kW', '150 de kilowați'],
  ['ro', '-5 °C', 'minus 5 grade Celsius'],
  ['ro', 'LKW PKW ADR ETA A6 B13 08:30', 'camion autoturism A D R ora estimată de sosire autostrada A 6 drumul B 13 ora 8 și 30 de minute'],
  ['de', 'LKW PKW ADR ETA A6 B13 08:30', 'Lastkraftwagen Personenkraftwagen A D R voraussichtliche Ankunftszeit Autobahn 6 Bundesstraße 13 8 Uhr 30'],
  ['en', 'LKW PKW ADR ETA A6 B13 08:30', 'truck passenger car A D R estimated time of arrival A 6 motorway B 13 road 8 thirty'],
];

for (const [language, input, expected] of exact) assert.equal(normalizeSpeechText(input, language), expected, `${language}: ${input}`);

const allMeasurements = '80 km/h, 30 km, 20 kg, 9 m, 4 cm, 2 mm, 15 l, -5 °C, 20 t, 7 bar, 24 V, 150 kW, 30%, 12 m², 8 m³';
for (const language of basicLanguageCodes) {
  const result = normalizeSpeechText(allMeasurements, language);
  assert.ok(result.length > allMeasurements.length, `${language}: measurements must be semantically expanded`);
  assert.doesNotMatch(result, /(?:\d|\bminus\b)\s*(?:km\/h|km|kg|cm|mm|kW|°C|V|t|m²|m³|%)(?=\W|$)/iu, `${language}: compact symbols must not reach TTS`);
  assert.equal(normalizeSpeechText(result, language), result, `${language}: normalization must be idempotent`);
  const transport = normalizeSpeechText('LKW PKW ADR ETA A6 B13 la 08:30', language);
  assert.doesNotMatch(transport, /\b(?:LKW|PKW|ETA|A6|B13)\b/, `${language}: transport tokens must be semantic`);
  assert.match(transport, /A D R/, `${language}: ADR must be spelled letter by letter`);
  assert.doesNotMatch(transport, /08:30/, `${language}: clock time must be localized`);
}

assert.deepEqual(speechTokenPolicy, {
  measurements: 'semantic-unit', LKW: 'expand', PKW: 'expand', ETA: 'expand', ADR: 'spell',
  routeIdentifiers: 'route', clockTimes: 'clock-time',
});

const visibleAnswer = 'Pe A6 sunt 30 °C, limita este 80 km/h, ETA 08:30.';
const spokenAnswer = normalizeSpeechText(visibleAnswer, 'ro-RO');
assert.equal(visibleAnswer, 'Pe A6 sunt 30 °C, limita este 80 km/h, ETA 08:30.');
assert.equal(spokenAnswer, 'Pe autostrada A 6 sunt 30 de grade Celsius, limita este 80 de kilometri pe oră, ora estimată de sosire ora 8 și 30 de minute.');

console.log('Global semantic speech normalization 12/12 PASS');
