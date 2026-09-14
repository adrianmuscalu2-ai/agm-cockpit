import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { GmailCommunicationProvider, GmailProviderError, type GmailInboxMessage } from '../communications/providers/gmail.provider';
import type { AssistantSourceReference, GmailActionContext } from './premium-assistant.contract';

export type GmailAssistantIntent = {
  operation: 'LIST_RECENT' | 'LIST_TODAY' | 'LATEST_FROM' | 'SEARCH_FROM' | 'SEARCH_TOPIC' | 'SUMMARIZE_RECENT';
  gmailQuery: string;
  maxMessages: number;
};

export type GmailAssistantResult = {
  intent: GmailAssistantIntent;
  messages: GmailInboxMessage[];
  sources: AssistantSourceReference[];
  actionContext?: Omit<GmailActionContext, 'traceId'> | null;
};

@Injectable()
export class PremiumAssistantGmailService {
  constructor(private readonly gmail: GmailCommunicationProvider) {}

  configured() {
    return this.gmail.configured();
  }

  async retrieve(text: string): Promise<GmailAssistantResult> {
    const intent = classifyGmailIntent(text);
    if (!intent) throw new Error('NOT_A_GMAIL_INTENT');
    const retrieved = await this.gmail.searchInbox(intent.gmailQuery, intent.maxMessages);
    const messages = intent.operation === 'LIST_TODAY' ? retrieved.filter((message) => isTodayInBerlin(message.occurredAt)) : retrieved;
    return { intent, messages, sources: messages.map(gmailSourceReference), actionContext: messages[0] ? extractGmailActionContext(messages[0]) : null };
  }
}

export function extractGmailActionContext(message: GmailInboxMessage): Omit<GmailActionContext, 'traceId'> {
  const body = compactMessageBody(message.bodyText);
  const lines = body.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const destinationLines = lines.filter((line) => /\b(?:adresa|adres[ăa]|address|adresse|desc[ăa]rcare|unloading|entladung|delivery|livrare)\b/i.test(line));
  const postalMatches = body.match(/(?:[A-ZĂÂÎȘȚÄÖÜ][^\n,;]{2,60}[, ]+)?\b\d{5}\s+[A-ZĂÂÎȘȚÄÖÜ][A-Za-zĂÂÎȘȚăâîșțÄÖÜäöüß .'-]{2,50}/g) ?? [];
  const destinations = unique([...destinationLines.map((line) => line.replace(/^.*?[:=-]\s*/, '')), ...postalMatches])
    .map((value) => cleanVisibleText(value, 240)).filter((value) => value.length >= 5).slice(0, 5);
  const phoneNumbers = unique((body.match(/(?:\+|00)?\d[\d ()/.-]{6,}\d/g) ?? []).map((value) => value.trim())).slice(0, 5);
  const dateTimes = extractDateTimes(body).slice(0, 5);
  const senderEmail = message.from.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1]?.toLowerCase() ?? null;
  const messageRef = `GMAIL-${createHash('sha256').update(message.id).digest('hex').slice(0, 20)}`;
  return {
    contractVersion: 'gmail-action-context.v1',
    messageRef,
    senderEmail,
    subject: cleanVisibleText(message.subject, 180),
    receivedAt: message.occurredAt,
    destinations,
    phoneNumbers,
    dateTimes,
    shareText: cleanVisibleText(`${message.subject}\n${body}`, 2000),
  };
}

function extractDateTimes(value: string) {
  const output: string[] = [];
  for (const match of value.matchAll(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\s+(?:la|at|um)?\s*(\d{1,2})[:.](\d{2}))?/g)) {
    const [, day, month, year, hour = '0', minute = '0'] = match;
    const date = berlinLocalDate(Number(year), Number(month), Number(day), Number(hour), Number(minute));
    if (Number.isFinite(date.getTime())) output.push(date.toISOString());
  }
  return unique(output);
}

function berlinLocalDate(year: number, month: number, day: number, hour: number, minute: number) {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(localAsUtc)).map((part) => [part.type, part.value]));
  const observedLocalAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  const resolved = new Date(localAsUtc - (observedLocalAsUtc - localAsUtc));
  const resolvedParts = Object.fromEntries(formatter.formatToParts(resolved).map((part) => [part.type, part.value]));
  const valid = Number(resolvedParts.year) === year && Number(resolvedParts.month) === month && Number(resolvedParts.day) === day
    && Number(resolvedParts.hour) === hour && Number(resolvedParts.minute) === minute;
  return valid ? resolved : new Date(Number.NaN);
}

function unique(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function classifyGmailIntent(text: string): GmailAssistantIntent | null {
  const normalized = normalize(text);
  const explicitGmail = /\bgmail\b/.test(normalized);
  const emailNoun = /\b(?:e-?mail(?:uri|s)?|mail(?:s)?|inbox|mesaj(?:e|ul)?|message(?:s)?|nachricht(?:en)?|correo(?:s)?|courriel(?:s)?|posta|post|wiadomosc(?:i)?|eposta|emaili|mejl)\b/.test(normalized);
  const inboxAction = /\b(?:primit|primesc|received|receive|got|latest|last|read|search|find|summari[sz]e|inbox|citesc|citeste|cauta|gaseste|rezuma|ultim(?:ul|ele|a)?|erhalten|bekommen|letzte|lesen|suche|finden|zusammenfassen|recu|recus|dernier|lire|chercher|resumer|ontvangen|laatste|lezen|zoeken|samenvatten|recibido|recibi|ultimo|leer|buscar|resumir|ricevuto|ultimo|leggi|cerca|riassumi|otrzymal|ostatni|czytaj|szukaj|podsumuj|gelen|son|oku|ara|ozetle|marr|fundit|lexo|kerko|permbledh)\b/.test(normalized);
  const implicitReceivedFrom = /\b(?:am primit(?: ceva)? de la|received (?:anything|something) from|etwas von .+ bekommen|recu quelque chose de|iets ontvangen van|recibi algo de|ricevuto qualcosa da)\b/.test(normalized);
  if (!(explicitGmail || (emailNoun && inboxAction) || implicitReceivedFrom)) return null;

  const maxMessages = requestedMessageCount(normalized);
  const sender = extractAfter(normalized, /\b(?:de la|from|von|van|da|od|nga)\s+/);
  const topic = extractAfter(normalized, /\b(?:despre|about|uber|over|sur|sobre|riguardo|dotyczace|hakkinda|rreth)\s+/);
  const today = /\b(?:azi|astazi|today|heute|aujourd'hui|vandaag|hoy|oggi|dzis|bugun|sot)\b/.test(normalized);
  const summarize = /\b(?:rezuma|summari[sz]e|zusammenfassen|resumer|samenvatten|resumir|riassumi|podsumuj|ozetle|permbledh)\b/.test(normalized);
  const latest = /\b(?:ultim(?:ul|a)?|latest|last|letzte|dernier|laatste|ultimo|ostatni|son|fundit)\b/.test(normalized);

  if (sender) return {
    operation: latest ? 'LATEST_FROM' : 'SEARCH_FROM',
    gmailQuery: `from:${quoteGmailTerm(sender)}`,
    maxMessages: latest ? 1 : maxMessages,
  };
  if (topic) return { operation: 'SEARCH_TOPIC', gmailQuery: quoteGmailTerm(topic), maxMessages: latest ? 1 : maxMessages };
  if (today) return { operation: 'LIST_TODAY', gmailQuery: 'newer_than:1d', maxMessages };
  if (summarize) return { operation: 'SUMMARIZE_RECENT', gmailQuery: '', maxMessages: latest ? 1 : maxMessages };
  return { operation: 'LIST_RECENT', gmailQuery: '', maxMessages: latest ? 1 : maxMessages };
}

export function gmailContext(messages: readonly GmailInboxMessage[]) {
  return messages.map((message) => ({
    messageId: message.id,
    threadId: message.threadId,
    from: message.from,
    to: message.to,
    subject: message.subject,
    receivedAt: message.occurredAt,
    bodyText: compactMessageBody(message.bodyText),
    attachments: message.attachments.map(({ filename, mimeType, size }) => ({ filename, mimeType, size })),
  }));
}

export function composeGmailAnswer(result: GmailAssistantResult, language: string) {
  const messages = result.messages;
  if (!messages.length) return localized(language, 'noResults', 0);
  const summaries = messages.map((message) => ({
    sender: displaySender(message.from),
    subject: cleanVisibleText(message.subject, 180),
    summary: messageSummary(message.bodyText),
    when: localizedDate(message.occurredAt, language),
  }));
  const first = summaries[0]!;
  if (result.intent.operation === 'LATEST_FROM') {
    return localized(language, 'latest', messages.length, first);
  }
  if (result.intent.operation === 'SEARCH_FROM' || result.intent.operation === 'SEARCH_TOPIC') {
    return localized(language, 'matches', messages.length, first, summaries.slice(1, 3));
  }
  if (result.intent.operation === 'SUMMARIZE_RECENT') {
    return localized(language, 'summary', messages.length, first, summaries.slice(1, 3));
  }
  return localized(language, result.intent.operation === 'LIST_TODAY' ? 'today' : 'recent', messages.length, first, summaries.slice(1, 3));
}

function gmailSourceReference(message: GmailInboxMessage): AssistantSourceReference {
  const observedAt = new Date();
  return {
    sourceId: `GMAIL-${createHash('sha256').update(message.id).digest('hex').slice(0, 20)}`,
    title: message.subject,
    origin: message.from,
    urlOrIdentifier: `gmail:message:${message.id}`,
    timestamp: message.occurredAt,
    domain: ['GMAIL_INBOX'],
    language: 'und',
    confidence: 1,
    originType: 'GMAIL',
    retrievalType: 'LIVE',
    freshness: { status: 'CURRENT', checkedAt: observedAt.toISOString(), expiresAt: new Date(observedAt.getTime() + 300_000).toISOString(), ttlSeconds: 300 },
    provenance: { canonicalPath: null, sha256: null, authorityType: 'AUTHENTICATED_PRIVATE_MAILBOX', reviewStatus: 'LIVE_PROVIDER_OBSERVATION' },
  };
}

function requestedMessageCount(value: string) {
  const digit = value.match(/\b([1-9]|1\d|20)\b/)?.[1];
  if (digit) return Number(digit);
  const words: Record<string, number> = { one: 1, unu: 1, un: 1, eine: 1, two: 2, doua: 2, doi: 2, zwei: 2, three: 3, trei: 3, drei: 3, troi: 3, four: 4, patru: 4, vier: 4, five: 5, cinci: 5, funf: 5 };
  for (const [word, count] of Object.entries(words)) if (new RegExp(`\\b${word}\\b`).test(value)) return count;
  return 5;
}

function extractAfter(value: string, prefix: RegExp) {
  const match = prefix.exec(value);
  if (!match) return '';
  return value.slice(match.index + match[0].length)
    .split(/[?!.;,]|\b(?:si\s+(?:deschide|navigheaza)|and\s+(?:open|navigate)|und\s+(?:offne|navigiere)|azi|astazi|today|heute|acum|now|in gmail|din gmail)\b/)[0]!
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(' ')
    .trim();
}

function quoteGmailTerm(value: string) {
  const safe = value.replace(/["{}\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return safe.includes(' ') ? `"${safe}"` : safe;
}

function compactMessageBody(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n(?:On .+ wrote:|Am .+ schrieb .+:|Le .+ a ecrit :)\s*$/i)[0]!
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 6_000);
}

type VisibleMessage = { sender: string; subject: string; summary: string; when: string };

function localized(language: string, kind: 'noResults' | 'latest' | 'matches' | 'summary' | 'today' | 'recent', count: number, first?: VisibleMessage, rest: VisibleMessage[] = []) {
  const item = (value: VisibleMessage) => `${value.sender}: „${value.subject}”${value.summary ? ` — ${value.summary}` : ''}`;
  const joined = [first, ...rest].filter((value): value is VisibleMessage => Boolean(value)).map(item).join(' Apoi, ');
  const ro = {
    noResults: 'Nu am găsit în Gmail niciun mesaj care să corespundă cererii tale.',
    latest: first ? `Ultimul mesaj de la ${first.sender} a sosit ${first.when} și are subiectul „${first.subject}”.${first.summary ? ` Pe scurt, ${lowerFirst(first.summary)}` : ''}` : '',
    matches: `Am găsit ${count === 1 ? 'un mesaj relevant' : `${count} mesaje relevante`} în Gmail. ${joined}`,
    summary: `Pe scurt, ultimele ${count} mesaje sunt acestea: ${joined}`,
    today: `Astăzi ai primit ${count === 1 ? 'un mesaj' : `${count} mesaje`} în Gmail. ${joined}`,
    recent: `Cele mai recente mesaje din Gmail sunt: ${joined}`,
  };
  const de = {
    noResults: 'Ich habe in Gmail keine Nachricht gefunden, die Ihrer Anfrage entspricht.',
    latest: first ? `Die letzte Nachricht von ${first.sender} kam ${first.when} mit dem Betreff „${first.subject}”.${first.summary ? ` Kurz gesagt: ${first.summary}` : ''}` : '',
    matches: `Ich habe ${count} passende ${count === 1 ? 'Nachricht' : 'Nachrichten'} in Gmail gefunden. ${joined}`,
    summary: `Kurz zusammengefasst sind die letzten ${count} Nachrichten: ${joined}`,
    today: `Heute haben Sie ${count} ${count === 1 ? 'Nachricht' : 'Nachrichten'} in Gmail erhalten. ${joined}`,
    recent: `Die neuesten Nachrichten in Gmail sind: ${joined}`,
  };
  const en = {
    noResults: 'I could not find any Gmail message matching your request.',
    latest: first ? `The latest message from ${first.sender} arrived ${first.when} with the subject “${first.subject}”.${first.summary ? ` In short, ${lowerFirst(first.summary)}` : ''}` : '',
    matches: `I found ${count} matching Gmail ${count === 1 ? 'message' : 'messages'}. ${joined}`,
    summary: `In short, the latest ${count} messages are: ${joined}`,
    today: `You received ${count} Gmail ${count === 1 ? 'message' : 'messages'} today. ${joined}`,
    recent: `Your latest Gmail messages are: ${joined}`,
  };
  return ((language === 'ro' ? ro : language === 'de' ? de : en)[kind]).replace(/\s+/g, ' ').trim();
}

function messageSummary(value: string) {
  const cleaned = cleanVisibleText(compactMessageBody(value), 700)
    .replace(/\b(?:unsubscribe|dezabonare|abbestellen)\b[\s\S]*$/i, '')
    .trim();
  if (!cleaned) return '';
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  return sentences.slice(0, 2).join(' ').trim().slice(0, 420);
}

function cleanVisibleText(value: string, maximum: number) {
  return value
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b(?:gmail:message:|GMAIL-)[A-Za-z0-9_-]+\b/g, '')
    .replace(/[\u0000-\u001F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function displaySender(value: string) {
  const display = value.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  if (display) return cleanVisibleText(display, 100);
  const address = value.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1];
  return cleanVisibleText(address?.split('@')[0]?.replace(/[._-]+/g, ' ') ?? value, 100) || 'expeditor necunoscut';
}

function localizedDate(value: string, language: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const locales: Record<string, string> = { ro: 'ro-RO', de: 'de-DE', en: 'en-GB', fr: 'fr-FR', nl: 'nl-NL', ru: 'ru-RU', pl: 'pl-PL', tr: 'tr-TR', sq: 'sq-AL', it: 'it-IT', es: 'es-ES', sv: 'sv-SE' };
  return new Intl.DateTimeFormat(locales[language] ?? 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(date);
}

function lowerFirst(value: string) {
  return value ? value[0]!.toLocaleLowerCase() + value.slice(1) : value;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isTodayInBerlin(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(date) === formatter.format(new Date());
}

export function gmailFailureCode(error: unknown) {
  if (error instanceof GmailProviderError) return error.code;
  return 'API_FAILED' as const;
}
