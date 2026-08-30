import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { appI18nDictionary } from '../src/i18n/app-i18n.dictionary';

const targets = ['it', 'es', 'sv'] as const;
const targetNames = { it: 'Italian', es: 'Spanish', sv: 'Swedish' } as const;
const source = appI18nDictionary.en;
const outputPath = resolve('src/i18n/final-language-app.dictionary.ts');
const cachePath = resolve('../../evidence/app-i18n/final-language-translation-cache.json');
const runFile = promisify(execFile);
const tokenPattern = /\r?\n|\{[a-zA-Z0-9_]+\}|https?:\/\/\S+|\b(?:AGM|OCR|VIN|GPS|PDF|WhatsApp|Car Mover)\b/g;

function protect(value: string) {
  const tokens: string[] = [];
  const text = value.replace(tokenPattern, (token) => {
    const index = tokens.push(token) - 1;
    return `__AGM_TOKEN_${index}__`;
  });
  return { text, tokens };
}

function restore(value: string, tokens: string[]) {
  return tokens.reduce(
    (result, token, index) => result.replaceAll(`__AGM_TOKEN_${index}__`, token),
    value,
  );
}

function translationSegments(payload: unknown): string[] {
  const result: string[] = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'string' && typeof value[1] === 'string') {
      result.push(value[0]);
      return;
    }
    for (const item of value) visit(item);
  };
  visit(payload);
  return result;
}

async function translateBatch(values: string[], target: (typeof targets)[number]) {
  const protectedValues = values.map(protect);
  const requestText = protectedValues
    .map(({ text }, index) => `<<<AGM_${String(index).padStart(4, '0')}>>> ${text}`)
    .join('\n');
  let lastError: unknown;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const { stdout } = await runFile('curl.exe', [
        '-sS', '--fail-with-body', '--get',
        '--data-urlencode', 'client=gtx',
        '--data-urlencode', 'sl=en',
        '--data-urlencode', `tl=${target}`,
        '--data-urlencode', 'dt=t',
        '--data-urlencode', `q=${requestText}`,
        'https://translate.googleapis.com/translate_a/single',
      ], { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 });
      const joined = translationSegments(JSON.parse(stdout)).join('\n');
      const translated = new Map<number, string>();
      const marker = /<<<AGM_(\d{4})>>>\s*([\s\S]*?)(?=<<<AGM_\d{4}>>>|$)/g;
      for (const match of joined.matchAll(marker)) translated.set(Number(match[1]), match[2].trim());
      if (translated.size !== values.length) {
        throw new Error(`Expected ${values.length} translations, received ${translated.size}`);
      }
      return protectedValues.map(({ tokens }, index) => restore(translated.get(index)!, tokens));
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
    }
  }
  throw lastError;
}

async function translateLanguage(target: (typeof targets)[number], cache: Record<string, Record<string, string>>) {
  const unique = [...new Set(Object.values(source))];
  const translations = new Map<string, string>(Object.entries(cache[target] ?? {}));
  let cursor = 0;

  while (cursor < unique.length) {
    const batch: string[] = [];
    let characters = 0;
    while (cursor < unique.length && batch.length < 10) {
      const candidate = unique[cursor];
      if (batch.length > 0 && characters + candidate.length > 1500) break;
      if (!translations.has(candidate)) batch.push(candidate);
      characters += candidate.length;
      cursor += 1;
    }
    if (batch.length > 0) {
      const translated = await translateBatch(batch, target);
      batch.forEach((value, index) => translations.set(value, translated[index]));
      cache[target] = Object.fromEntries(translations);
      await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');
    }
    process.stdout.write(`${targetNames[target]} ${cursor}/${unique.length}\r`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
  }
  process.stdout.write(`${targetNames[target]} ${unique.length}/${unique.length}\n`);
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, translations.get(value)!]));
}

await mkdir(resolve('../../evidence/app-i18n'), { recursive: true });
const cachedPayload = await readFile(cachePath, 'utf8').then((value) => JSON.parse(value)).catch(() => ({})) as Record<string, unknown>;
const cache = (cachedPayload.__parserVersion === 2 ? cachedPayload : { __parserVersion: 2 }) as Record<string, Record<string, string>>;
const result: Record<string, Record<string, string>> = {};
for (const target of targets) result[target] = await translateLanguage(target, cache);

const auditedOverrides: Record<typeof targets[number], Record<string, string>> = {
  it: {
    'premium.loadSafety.title': 'Assistente alla sicurezza del carico',
    'premium.loadSafety.status.ready': 'L’assistente alla sicurezza del carico è pronto.',
    'premium.loadSafety.status.endpoint': 'Il backend AGM non contiene ancora l’endpoint aggiornato per la sicurezza del carico.',
  },
  es: {
    'premium.loadSafety.title': 'Asistente de sujeción de carga',
    'premium.loadSafety.status.endpoint': 'El backend de AGM aún no contiene el endpoint actualizado para la sujeción de carga.',
  },
  sv: {
    'premium.loadSafety.title': 'Assistent för lastsäkring',
    'premium.loadSafety.status.ready': 'Assistenten för lastsäkring är redo.',
    'premium.loadSafety.status.endpoint': 'AGM-backend innehåller ännu inte den uppdaterade slutpunkten för lastsäkring.',
    'premium.team.eyebrow': 'AGM PREMIUM · TEAMET',
    'turn.department.releaseOps': 'Lansering och drift',
    'turn.agent.release': 'Lansering',
    'turn.module.legal': 'Juridiskt center',
    'agentRegistry.chronicler.role': 'Chef för operativt minne.',
    'mail.manual': 'Manuell',
    'contact.category.partners': 'Partner',
  },
};
for (const target of targets) Object.assign(result[target], auditedOverrides[target]);

const file = `// Generated from the canonical English application catalog.\n` +
  `// Source language: en. Targets: it, es, sv. Do not edit individual keys manually.\n` +
  `export const finalLanguageAppDictionary = ${JSON.stringify(result, null, 2)} as const;\n`;
await writeFile(outputPath, file, 'utf8');
console.log(`Wrote ${outputPath}`);
