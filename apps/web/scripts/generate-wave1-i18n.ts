import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { appI18nDictionary } from '../src/i18n/app-i18n.dictionary';

const targets = ['fr', 'nl', 'ru', 'pl', 'tr', 'sq'] as const;
const prefixes = ['home.', 'basic.', 'advanced.', 'warning.', 'nav.', 'header.', 'language.', 'translator.', 'mail.', 'ocr.', 'profile.', 'contact.', 'textCorrector.', 'tutorial.', 'roadmap.', 'legal.', 'about.', 'module.', 'app.', 'command.', 'common.', 'ready.', 'status.'];
const endpoint = process.env.AGM_TRANSLATION_GENERATOR_URL ?? 'http://127.0.0.1:3001/api/v1/translation/actions/translate-text';
const english = appI18nDictionary.en ?? {};
const keys = Object.keys(english).filter((key) => prefixes.some((prefix) => key.startsWith(prefix))).sort();

function placeholders(text: string) {
  return [...text.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort().join('|');
}

function maskPlaceholders(source: string, lineIndex: number) {
  let masked = source.replaceAll('\r\n', 'ZXQNLQXZ').replaceAll('\n', 'ZXQNLQXZ');
  [...source.matchAll(/\{[^}]+\}/g)].forEach((match, placeholderIndex) => {
    masked = masked.replace(match[0], `ZXQ${lineIndex}P${placeholderIndex}QXZ`);
  });
  return masked;
}

function restorePlaceholders(source: string, translatedValue: string, lineIndex: number) {
  let restored = translatedValue.replaceAll('ZXQNLQXZ', '\n');
  [...source.matchAll(/\{[^}]+\}/g)].forEach((match, placeholderIndex) => {
    restored = restored.replace(`ZXQ${lineIndex}P${placeholderIndex}QXZ`, match[0]);
  });
  return restored;
}

function batches(selectedKeys = keys) {
  const result: Array<Array<[string, string]>> = [];
  let current: Array<[string, string]> = [];
  let size = 0;
  for (const key of selectedKeys) {
    const lineSize = key.length + english[key].length + 20;
    if (current.length && size + lineSize > 3500) { result.push(current); current = []; size = 0; }
    current.push([key, english[key]]); size += lineSize;
  }
  if (current.length) result.push(current);
  return result;
}

const checkpointUrl = new URL('../../../.tmp/wave1-i18n-generator.json', import.meta.url);
await mkdir(new URL('.', checkpointUrl), { recursive: true });
let translated: Record<string, Record<string, string>> = {};
try { translated = JSON.parse(await readFile(checkpointUrl, 'utf8')); } catch {}
let requestCount = 0;
for (const language of targets) {
  translated[language] ??= {};
  const missingKeys = keys.filter((key) => !translated[language][key]);
  for (const batch of batches(missingKeys)) {
    if (requestCount > 0 && requestCount % 18 === 0) await new Promise((resolve) => setTimeout(resolve, 61_000));
    const text = batch.map(([key, value], index) => `⟦${index}⟧ ${maskPlaceholders(value, index)}`).join('\n');
    let payload: { data?: { available?: boolean; text?: string } } | undefined;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, sourceLanguage: 'en', targetLanguage: language }),
      });
      requestCount += 1;
      if (response.ok) payload = await response.json() as { data?: { available?: boolean; text?: string } };
      if (payload?.data?.available && payload.data.text) break;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    if (!payload?.data?.available || !payload.data.text) throw new Error(`Translation ${language} unavailable after retries`);
    const matches = [...payload.data.text.matchAll(/⟦(\d+)⟧\s*([^\n]*)/g)];
    if (matches.length !== batch.length) throw new Error(`Translation ${language} returned ${matches.length}/${batch.length} lines`);
    for (const match of matches) {
      const [key, source] = batch[Number(match[1])];
      const value = restorePlaceholders(source, match[2].trim(), Number(match[1]));
      if (!value || placeholders(value) !== placeholders(source)) throw new Error(`Invalid placeholders for ${language}.${key}`);
      translated[language][key] = value;
    }
    await writeFile(checkpointUrl, `${JSON.stringify(translated, null, 2)}\n`, 'utf8');
  }
}

for (const language of targets) {
  if (Object.keys(translated[language]).length !== keys.length) throw new Error(`Incomplete ${language} catalog`);
}

const output = `import type { LanguageCode } from '../emailLanguage';\n\ntype Wave1Language = Exclude<LanguageCode, 'ro' | 'de' | 'en'>;\n\nexport const wave1BasicI18nDictionary = ${JSON.stringify(translated, null, 2)} satisfies Record<Wave1Language, Record<string, string>>;\n`;
await writeFile(new URL('../src/i18n/wave1-basic-i18n.dictionary.ts', import.meta.url), output, 'utf8');
console.log(`Generated ${keys.length} keys for ${targets.length} Wave 1 languages.`);
