import { basicLanguageCodes, basicLanguageRegistry, type BasicLanguageCode } from './language-registry';

export type SpeechTokenMode = 'semantic-unit' | 'expand' | 'spell' | 'route' | 'clock-time';

export const speechTokenPolicy = Object.freeze({
  measurements: 'semantic-unit',
  LKW: 'expand',
  PKW: 'expand',
  ETA: 'expand',
  ADR: 'spell',
  routeIdentifiers: 'route',
  clockTimes: 'clock-time',
} satisfies Record<string, SpeechTokenMode>);

type UnitId =
  | 'kilometer-per-hour' | 'square-meter' | 'cubic-meter' | 'celsius' | 'kilowatt'
  | 'kilometer' | 'kilogram' | 'centimeter' | 'millimeter' | 'meter' | 'liter'
  | 'tonne' | 'bar' | 'volt' | 'percent';
type UnitForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const localeByLanguage = Object.fromEntries(
  basicLanguageCodes.map((language) => [language, basicLanguageRegistry[language].speechLocale]),
) as Record<BasicLanguageCode, string>;

const intlUnits: Partial<Record<UnitId, string>> = {
  'kilometer-per-hour': 'kilometer-per-hour', kilometer: 'kilometer', kilogram: 'kilogram',
  centimeter: 'centimeter', millimeter: 'millimeter', meter: 'meter', liter: 'liter',
  celsius: 'celsius', percent: 'percent',
};

const fallbackUnits: Record<BasicLanguageCode, Record<'tonne'|'bar'|'volt'|'kilowatt'|'square-meter'|'cubic-meter', UnitForms>> = {
  ro: {
    tonne: { one: 'tonă', few: 'tone', other: 'tone' }, bar: { one: 'bar', other: 'bari' },
    volt: { one: 'volt', other: 'volți' }, kilowatt: { one: 'kilowatt', other: 'kilowați' },
    'square-meter': { one: 'metru pătrat', other: 'metri pătrați' },
    'cubic-meter': { one: 'metru cub', other: 'metri cubi' },
  },
  de: {
    tonne: { one: 'Tonne', other: 'Tonnen' }, bar: { other: 'Bar' }, volt: { other: 'Volt' },
    kilowatt: { other: 'Kilowatt' }, 'square-meter': { other: 'Quadratmeter' }, 'cubic-meter': { other: 'Kubikmeter' },
  },
  en: {
    tonne: { one: 'tonne', other: 'tonnes' }, bar: { one: 'bar', other: 'bars' },
    volt: { one: 'volt', other: 'volts' }, kilowatt: { one: 'kilowatt', other: 'kilowatts' },
    'square-meter': { one: 'square meter', other: 'square meters' },
    'cubic-meter': { one: 'cubic meter', other: 'cubic meters' },
  },
  fr: {
    tonne: { one: 'tonne', other: 'tonnes' }, bar: { one: 'bar', other: 'bars' },
    volt: { one: 'volt', other: 'volts' }, kilowatt: { one: 'kilowatt', other: 'kilowatts' },
    'square-meter': { one: 'mètre carré', other: 'mètres carrés' },
    'cubic-meter': { one: 'mètre cube', other: 'mètres cubes' },
  },
  nl: {
    tonne: { other: 'ton' }, bar: { other: 'bar' }, volt: { other: 'volt' }, kilowatt: { other: 'kilowatt' },
    'square-meter': { other: 'vierkante meter' }, 'cubic-meter': { other: 'kubieke meter' },
  },
  ru: {
    tonne: { one: 'тонна', few: 'тонны', many: 'тонн', other: 'тонны' },
    bar: { one: 'бар', few: 'бара', many: 'бар', other: 'бара' },
    volt: { one: 'вольт', few: 'вольта', many: 'вольт', other: 'вольта' },
    kilowatt: { one: 'киловатт', few: 'киловатта', many: 'киловатт', other: 'киловатта' },
    'square-meter': { one: 'квадратный метр', few: 'квадратных метра', many: 'квадратных метров', other: 'квадратного метра' },
    'cubic-meter': { one: 'кубический метр', few: 'кубических метра', many: 'кубических метров', other: 'кубического метра' },
  },
  pl: {
    tonne: { one: 'tona', few: 'tony', many: 'ton', other: 'tony' },
    bar: { one: 'bar', few: 'bary', many: 'barów', other: 'bara' },
    volt: { one: 'wolt', few: 'wolty', many: 'woltów', other: 'wolta' },
    kilowatt: { one: 'kilowat', few: 'kilowaty', many: 'kilowatów', other: 'kilowata' },
    'square-meter': { one: 'metr kwadratowy', few: 'metry kwadratowe', many: 'metrów kwadratowych', other: 'metra kwadratowego' },
    'cubic-meter': { one: 'metr sześcienny', few: 'metry sześcienne', many: 'metrów sześciennych', other: 'metra sześciennego' },
  },
  tr: {
    tonne: { other: 'ton' }, bar: { other: 'bar' }, volt: { other: 'volt' }, kilowatt: { other: 'kilovat' },
    'square-meter': { other: 'metrekare' }, 'cubic-meter': { other: 'metreküp' },
  },
  sq: {
    tonne: { one: 'ton', other: 'tonë' }, bar: { other: 'bar' }, volt: { other: 'volt' },
    kilowatt: { other: 'kilovat' }, 'square-meter': { one: 'metër katror', other: 'metra katrorë' },
    'cubic-meter': { one: 'metër kub', other: 'metra kub' },
  },
  it: {
    tonne: { one: 'tonnellata', other: 'tonnellate' }, bar: { other: 'bar' }, volt: { other: 'volt' },
    kilowatt: { other: 'kilowatt' }, 'square-meter': { one: 'metro quadrato', other: 'metri quadrati' },
    'cubic-meter': { one: 'metro cubo', other: 'metri cubi' },
  },
  es: {
    tonne: { one: 'tonelada', other: 'toneladas' }, bar: { one: 'bar', other: 'bares' },
    volt: { one: 'voltio', other: 'voltios' }, kilowatt: { one: 'kilovatio', other: 'kilovatios' },
    'square-meter': { one: 'metro cuadrado', other: 'metros cuadrados' },
    'cubic-meter': { one: 'metro cúbico', other: 'metros cúbicos' },
  },
  sv: {
    tonne: { one: 'ton', other: 'ton' }, bar: { other: 'bar' }, volt: { other: 'volt' },
    kilowatt: { other: 'kilowatt' }, 'square-meter': { one: 'kvadratmeter', other: 'kvadratmeter' },
    'cubic-meter': { one: 'kubikmeter', other: 'kubikmeter' },
  },
};

const minusWords: Record<BasicLanguageCode, string> = {
  ro: 'minus', de: 'minus', en: 'minus', fr: 'moins', nl: 'min', ru: 'минус', pl: 'minus',
  tr: 'eksi', sq: 'minus', it: 'meno', es: 'menos', sv: 'minus',
};

const expansions: Record<BasicLanguageCode, Record<'LKW'|'PKW'|'ETA', string>> = {
  ro: { LKW: 'camion', PKW: 'autoturism', ETA: 'ora estimată de sosire' },
  de: { LKW: 'Lastkraftwagen', PKW: 'Personenkraftwagen', ETA: 'voraussichtliche Ankunftszeit' },
  en: { LKW: 'truck', PKW: 'passenger car', ETA: 'estimated time of arrival' },
  fr: { LKW: 'poids lourd', PKW: 'voiture particulière', ETA: 'heure d’arrivée estimée' },
  nl: { LKW: 'vrachtwagen', PKW: 'personenauto', ETA: 'verwachte aankomsttijd' },
  ru: { LKW: 'грузовой автомобиль', PKW: 'легковой автомобиль', ETA: 'расчётное время прибытия' },
  pl: { LKW: 'samochód ciężarowy', PKW: 'samochód osobowy', ETA: 'przewidywany czas przyjazdu' },
  tr: { LKW: 'kamyon', PKW: 'binek otomobil', ETA: 'tahmini varış zamanı' },
  sq: { LKW: 'kamion', PKW: 'automjet', ETA: 'koha e parashikuar e mbërritjes' },
  it: { LKW: 'autocarro', PKW: 'autovettura', ETA: 'orario stimato di arrivo' },
  es: { LKW: 'camión', PKW: 'turismo', ETA: 'hora estimada de llegada' },
  sv: { LKW: 'lastbil', PKW: 'personbil', ETA: 'beräknad ankomsttid' },
};

const routes: Record<BasicLanguageCode, Record<'A'|'B', (number: string) => string>> = {
  ro: { A: (n) => `autostrada A ${n}`, B: (n) => `drumul B ${n}` },
  de: { A: (n) => `Autobahn ${n}`, B: (n) => `Bundesstraße ${n}` },
  en: { A: (n) => `A ${n} motorway`, B: (n) => `B ${n} road` },
  fr: { A: (n) => `autoroute A ${n}`, B: (n) => `route B ${n}` },
  nl: { A: (n) => `autosnelweg A ${n}`, B: (n) => `B ${n} weg` },
  ru: { A: (n) => `автомагистраль A ${n}`, B: (n) => `дорога B ${n}` },
  pl: { A: (n) => `autostrada A ${n}`, B: (n) => `droga B ${n}` },
  tr: { A: (n) => `A ${n} otoyolu`, B: (n) => `B ${n} yolu` },
  sq: { A: (n) => `autostrada A ${n}`, B: (n) => `rruga B ${n}` },
  it: { A: (n) => `autostrada A ${n}`, B: (n) => `strada B ${n}` },
  es: { A: (n) => `autopista A ${n}`, B: (n) => `carretera B ${n}` },
  sv: { A: (n) => `motorväg A ${n}`, B: (n) => `väg B ${n}` },
};

const unitPattern = /(^|[^\p{L}\p{N}])([−-]?\d+(?:[.,]\d+)?)\s*(km\/h|m[²2]|m[³3]|°\s*c|kW|km|kg|cm|mm|bar|V|t|m|[lL]|%)(?=$|[^\p{L}\p{N}])/giu;

export function normalizeSpeechText(text: string, languageOrLocale: BasicLanguageCode | string): string {
  const language = resolveLanguage(languageOrLocale);
  let spoken = text;
  spoken = spoken.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, hour, minute) => formatTime(Number(hour), Number(minute), language));
  spoken = spoken.replace(/\b([AB])(\d{1,4})\b/g, (_, kind: 'A'|'B', number: string) => routes[language][kind](number));
  spoken = spoken.replace(/\b(LKW|PKW|ETA|ADR)\b/g, (match) => {
    const token = match as 'LKW'|'PKW'|'ETA'|'ADR';
    return token === 'ADR' ? 'A D R' : expansions[language][token];
  });
  spoken = spoken.replace(unitPattern, (_, prefix: string, numeric: string, symbol: string) => `${prefix}${formatMeasurement(numeric, symbol, language)}`);
  return spoken.replace(/[\u00a0\u202f]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

function resolveLanguage(value: string): BasicLanguageCode {
  const candidate = value.trim().toLowerCase().split(/[-_]/)[0] as BasicLanguageCode;
  return basicLanguageCodes.includes(candidate) ? candidate : 'en';
}

function formatMeasurement(rawNumber: string, rawSymbol: string, language: BasicLanguageCode): string {
  const negative = /^[−-]/.test(rawNumber);
  const unsigned = rawNumber.replace(/^[−-]/, '');
  const value = Number(unsigned.replace(',', '.'));
  if (!Number.isFinite(value)) return `${rawNumber} ${rawSymbol}`;
  const unit = resolveUnit(rawSymbol);
  const locale = localeByLanguage[language];
  const fractionDigits = unsigned.split(/[.,]/)[1]?.length ?? 0;
  const options = { useGrouping: false, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
  let localized: string;
  const intlUnit = intlUnits[unit];
  if (intlUnit) {
    try {
      localized = new Intl.NumberFormat(locale, { ...options, style: 'unit', unit: intlUnit, unitDisplay: 'long' }).format(value);
    } catch {
      localized = `${new Intl.NumberFormat(locale, options).format(value)} ${rawSymbol}`;
    }
  } else {
    const number = new Intl.NumberFormat(locale, options).format(value);
    const forms = fallbackUnits[language][unit as keyof typeof fallbackUnits[BasicLanguageCode]];
    const category = new Intl.PluralRules(locale).select(value);
    const label = forms[category] ?? forms.other;
    const connector = language === 'ro' && value >= 20 ? ' de ' : ' ';
    localized = `${number}${connector}${label}`;
  }
  return negative ? `${minusWords[language]} ${localized}` : localized;
}

function resolveUnit(symbol: string): UnitId {
  const key = symbol.toLowerCase().replace(/\s/g, '').replace('²', '2').replace('³', '3');
  return ({
    'km/h': 'kilometer-per-hour', m2: 'square-meter', m3: 'cubic-meter', '°c': 'celsius', kw: 'kilowatt',
    km: 'kilometer', kg: 'kilogram', cm: 'centimeter', mm: 'millimeter', bar: 'bar', v: 'volt',
    t: 'tonne', m: 'meter', l: 'liter', '%': 'percent',
  } as Record<string, UnitId>)[key] ?? 'meter';
}

function formatTime(hour: number, minute: number, language: BasicLanguageCode): string {
  if (minute === 0) return ({
    ro: `ora ${hour} fix`, de: `${hour} Uhr`, en: `${hour} o'clock`, fr: `${hour} heures`, nl: `${hour} uur`,
    ru: `${hour} часов`, pl: `godzina ${hour}`, tr: `saat ${hour}`, sq: `ora ${hour}`, it: `le ${hour}`,
    es: `las ${hour}`, sv: `klockan ${hour}`,
  } as Record<BasicLanguageCode, string>)[language];
  if (language === 'en') return `${hour} ${minute < 10 ? `oh ${englishNumber(minute)}` : englishNumber(minute)}`;
  return ({
    ro: `ora ${hour} și ${minute} de minute`, de: `${hour} Uhr ${minute}`, fr: `${hour} heures ${minute}`,
    nl: `${hour} uur ${minute}`, ru: `${hour} часов ${minute} минут`, pl: `godzina ${hour} i ${minute} minut`,
    tr: `saat ${hour} ${minute}`, sq: `ora ${hour} e ${minute}`, it: `le ${hour} e ${minute}`,
    es: `las ${hour} y ${minute}`, sv: `klockan ${hour} och ${minute}`,
  } as Partial<Record<BasicLanguageCode, string>>)[language]!;
}

function englishNumber(value: number): string {
  const small = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  if (value < 20) return small[value]!;
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
  return value % 10 ? `${tens[Math.floor(value / 10)]} ${small[value % 10]}` : tens[Math.floor(value / 10)]!;
}
