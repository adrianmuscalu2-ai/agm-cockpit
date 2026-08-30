import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { emailTemplates } from '../src/emailTemplates';
import { preDepartureCopy } from '../src/pre-departure/pre-departure.i18n';
import { afterDepartureCopy } from '../src/poc02-after-departure/after-departure.i18n';
import { afterDepartureOperationalEnglish } from '../src/poc02-after-departure/after-departure.operational-i18n';
import { maintenanceEnglishSource } from '../src/maintenance-department';

const targets = ['it', 'es', 'sv'] as const;
const runFile = promisify(execFile);
const cachePath = resolve('../../evidence/app-i18n/final-language-translation-cache.json');
const outputPath = resolve('src/i18n/final-language-operational.dictionary.ts');
const tokenPattern = /\r?\n|\{[a-zA-Z0-9_]+\}|https?:\/\/\S+|\b(?:AGM|OCR|VIN|GPS|PDF|WhatsApp|Car Mover|CMR|ADR|READY|IndexedDB)\b/g;
const source = {
  preDeparture: preDepartureCopy.en,
  afterDeparture: afterDepartureCopy.en,
  afterDepartureOperational: afterDepartureOperationalEnglish,
  emailTemplates: Object.fromEntries(emailTemplates.map((item) => [item.id, item.translations.en])),
  maintenance: maintenanceEnglishSource,
};

function protect(value: string) {
  const tokens: string[] = [];
  return {
    text: value.replace(tokenPattern, (token) => `__AGM_TOKEN_${tokens.push(token) - 1}__`),
    tokens,
  };
}

function restore(value: string, tokens: string[]) {
  return tokens.reduce((result, token, index) => result.replaceAll(`__AGM_TOKEN_${index}__`, token), value);
}

function segments(payload: unknown): string[] {
  const result: string[] = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'string' && typeof value[1] === 'string') {
      result.push(value[0]);
      return;
    }
    value.forEach(visit);
  };
  visit(payload);
  return result;
}

async function translateBatch(values: string[], target: typeof targets[number]) {
  const protectedValues = values.map(protect);
  const requestText = protectedValues.map(({ text }, index) => `<<<AGM_${String(index).padStart(4, '0')}>>> ${text}`).join('\n');
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const { stdout } = await runFile('curl.exe', [
        '-sS', '--fail-with-body', '--get', '--data-urlencode', 'client=gtx', '--data-urlencode', 'sl=en',
        '--data-urlencode', `tl=${target}`, '--data-urlencode', 'dt=t', '--data-urlencode', `q=${requestText}`,
        'https://translate.googleapis.com/translate_a/single',
      ], { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 });
      const translated = new Map<number, string>();
      const marker = /<<<AGM_(\d{4})>>>\s*([\s\S]*?)(?=<<<AGM_\d{4}>>>|$)/g;
      for (const match of segments(JSON.parse(stdout)).join('\n').matchAll(marker)) translated.set(Number(match[1]), match[2].trim());
      if (translated.size !== values.length) throw new Error(`Expected ${values.length}; received ${translated.size}`);
      return protectedValues.map(({ tokens }, index) => restore(translated.get(index)!, tokens));
    } catch (error) {
      lastError = error;
      await new Promise((done) => setTimeout(done, attempt * 750));
    }
  }
  throw lastError;
}

function stringLeaves(value: unknown, result = new Set<string>()) {
  if (typeof value === 'string') result.add(value);
  else if (Array.isArray(value)) value.forEach((item) => stringLeaves(item, result));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => stringLeaves(item, result));
  return result;
}

function rebuild(value: unknown, translations: Map<string, string>): unknown {
  if (typeof value === 'string') return translations.get(value)!;
  if (Array.isArray(value)) return value.map((item) => rebuild(item, translations));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebuild(item, translations)]));
  return value;
}

const cachedPayload = JSON.parse(await readFile(cachePath, 'utf8')) as Record<string, unknown>;
const cache = (cachedPayload.__parserVersion === 2 ? cachedPayload : { __parserVersion: 2 }) as Record<string, Record<string, string>>;
const unique = [...stringLeaves(source)];
const output: Record<string, unknown> = {};
for (const target of targets) {
  const translations = new Map(Object.entries(cache[target] ?? {}));
  const pending = unique.filter((value) => !translations.has(value));
  for (let cursor = 0; cursor < pending.length;) {
    const batch: string[] = [];
    let characters = 0;
    while (cursor < pending.length && batch.length < 10) {
      const candidate = pending[cursor];
      if (batch.length && characters + candidate.length > 1500) break;
      batch.push(candidate); characters += candidate.length; cursor += 1;
    }
    const translated = await translateBatch(batch, target);
    batch.forEach((value, index) => translations.set(value, translated[index]));
    cache[target] = Object.fromEntries(translations);
    await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');
    process.stdout.write(`${target} ${cursor}/${pending.length}\r`);
    await new Promise((done) => setTimeout(done, 750));
  }
  output[target] = rebuild(source, translations);
  const finalCatalog = output[target] as {
    preDeparture: { languageHint: string; checks: Record<string, string>; actions: Record<string, string> };
    maintenance: { members: Array<{ id: string; icon: string; name: string; title: string }> };
  };
  finalCatalog.preDeparture.languageHint = {
    it: 'Tutte le 12 lingue mantengono la stessa logica e gli stessi stati.',
    es: 'Los 12 idiomas mantienen la misma lógica y los mismos estados.',
    sv: 'Alla 12 språk behåller samma logik och samma tillstånd.',
  }[target];
  finalCatalog.maintenance.members.forEach((member, index) => {
    const canonical = maintenanceEnglishSource.members[index];
    member.id = canonical.id;
    member.icon = canonical.icon;
    member.name = canonical.name;
  });
  if (target === 'it') {
    Object.assign(finalCatalog.preDeparture.checks, {
      tachograph:'Tachigrafo e tempi', cargo:'Carico e fissaggio', route:'Percorso e restrizioni',
      adr:'Controllo ADR', weather:'Notte / condizioni meteo',
    });
    finalCatalog.preDeparture.actions.na = 'Non applicabile';
  }
  if (target === 'sv') {
    finalCatalog.maintenance.members[3].title = 'Chef för operativt minne';
    finalCatalog.maintenance.members[4].title = 'Chef för återanvändbar kunskap';
  }
  process.stdout.write(`${target} ${pending.length}/${pending.length}\n`);
}

await writeFile(outputPath, `// Generated from English UI-only operational catalogs.\nexport const finalLanguageOperationalDictionary = ${JSON.stringify(output, null, 2)} as const;\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
