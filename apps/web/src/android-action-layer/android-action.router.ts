import type { ActiveDriverContext, AndroidActionPayload, AndroidActionResolution } from './android-action.contract';
import { confirmationFor } from './confirmation-policy';

const resolved = (action: NonNullable<AndroidActionResolution['action']>, reason: string, source: AndroidActionResolution['source'], payload: AndroidActionResolution['payload'] = {}): AndroidActionResolution => ({
  contractVersion: 'android-action-resolution.v1', status: 'RESOLVED', action, reason, source, payload, confirmation: confirmationFor(action),
});
const unresolved = (status: 'CLARIFICATION_REQUIRED' | 'UNSUPPORTED', reason: string): AndroidActionResolution => ({
  contractVersion: 'android-action-resolution.v1', status, reason, source: 'NONE', confirmation: 'NONE',
});

export function routeAndroidAction(text: string, context: ActiveDriverContext | null): AndroidActionResolution {
  const raw = text.trim();
  const value = normalize(raw);
  if (!value) return unresolved('CLARIFICATION_REQUIRED', 'EMPTY_REQUEST');
  if (/\b(citeste l|read it|lies es|lecture|leggilo|leelo)\b/.test(value)) {
    return context?.answerText ? resolved('READ_CONTEXT', 'ACTIVE_CONTEXT_AVAILABLE', 'ACTIVE_GMAIL_CONTEXT', { contextText: context.answerText }) : unresolved('CLARIFICATION_REQUIRED', 'ACTIVE_CONTEXT_REQUIRED');
  }
  if (/\b(navigheaza|navigare|du[ -]ma|condu[ -]ma|mergi|route|navigate|navigation|fahr|navigiere|itineraire)\b/.test(value)) {
    const requested = extractNavigationDestination(raw);
    const contextualReference = /^(?:acolo|there|dort|da|la|(?:adresa|address|adresse).*(?:ultim(?:ul|a)?\s+(?:e-?mail|mail|mesaj)|latest\s+(?:e-?mail|message)|letzte[nrs]?\s+(?:e-?mail|nachricht)))$/i.test(normalize(requested));
    const destination = contextualReference || !requested ? context?.destinations[0] : requested;
    const payload: AndroidActionPayload = {};
    if (destination) payload.value = destination;
    const navigationApp = requestedNavigationApp(value);
    if (navigationApp) payload.navigationApp = navigationApp;
    return destination
      ? resolved('NAVIGATION', 'DESTINATION_RESOLVED', contextualReference || !requested ? 'ACTIVE_GMAIL_CONTEXT' : 'REQUEST', payload)
      : unresolved('CLARIFICATION_REQUIRED', 'DESTINATION_REQUIRED');
  }
  const openApp = /\b(?:deschide|porneste|open|launch|start|offne|starte)\s+(?:aplicatia\s+|the\s+app\s+)?(google maps|maps|waze|tom tom|tomtom|gmail|camera|kamera)\b/i.exec(value);
  if (openApp) {
    const labels: Record<string, string> = { maps:'Maps','google maps':'Maps',waze:'Waze','tom tom':'TomTom',tomtom:'TomTom',gmail:'Gmail',camera:'Camera',kamera:'Camera' };
    return resolved('OPEN_APP', 'APP_LABEL_RESOLVED', 'REQUEST', { value: labels[openApp[1]!] ?? openApp[1] });
  }
  const messengerContact = /(?:deschide|open|offne)\s+(?:(?:chatul|conversatia|chat)\s+)?messenger(?:\s+(?:pentru|cu|lui|for|with|fur|mit))?\s+(.+)/i.exec(raw);
  if (messengerContact) {
    const contactName = cleanContactName(messengerContact[1] ?? '');
    return contactName
      ? resolved('MESSENGER_CHAT', 'MESSENGER_CONTACT_RESOLUTION_REQUIRED', 'REQUEST', { contactName })
      : unresolved('CLARIFICATION_REQUIRED', 'MESSENGER_CONTACT_REQUIRED');
  }
  const emailContact = /(?:trimite|scrie|compune|send|write|compose|sende|schreibe)\s+(?:un\s+)?(?:e-?mail|email)(?:\s+(?:lui|catre|c[Äƒa]tre|to|an))?\s+(.+)/i.exec(raw);
  if (emailContact) {
    const contactName = cleanContactName(emailContact[1] ?? '');
    return contactName
      ? resolved('EMAIL_DRAFT', 'EMAIL_CONTACT_RESOLUTION_REQUIRED', 'REQUEST', { contactName })
      : unresolved('CLARIFICATION_REQUIRED', 'EMAIL_CONTACT_REQUIRED');
  }
  if (/\b(suna|apeleaza|formeaza|dial|call|anrufen|ruf)\b/.test(value)) {
    const explicitPhone = raw.match(/\+?[0-9][0-9 ()\/-]{5,}[0-9]/)?.[0]?.trim();
    if (explicitPhone) return resolved('DIAL', 'PHONE_RESOLVED', 'REQUEST', { value: explicitPhone });
    const contactName = extractContactName(raw);
    if (contactName) return resolved('DIAL', 'CONTACT_NAME_RESOLUTION_REQUIRED', 'REQUEST', { contactName });
    const contextualPhone = context?.phoneNumbers[0];
    return contextualPhone ? resolved('DIAL', 'PHONE_RESOLVED', 'ACTIVE_GMAIL_CONTEXT', { value: contextualPhone }) : unresolved('CLARIFICATION_REQUIRED', 'PHONE_OR_CONTACT_REQUIRED');
  }
  if (/\b(raspunde|reply|antworte|antworten)\b/.test(value)) {
    if (!context?.senderEmail) return unresolved('CLARIFICATION_REQUIRED', 'EMAIL_CONTEXT_REQUIRED');
    const body = directValue(raw, /(?:r[ăa]spunde(?:\s+c[ăa])?|reply(?:\s+that)?|antworte(?:\s+dass)?)\s+/i);
    if (!body) return unresolved('CLARIFICATION_REQUIRED', 'REPLY_TEXT_REQUIRED');
    return resolved('EMAIL_DRAFT', 'EMAIL_DRAFT_PREPARED_NO_SEND', 'ACTIVE_GMAIL_CONTEXT', { value: context.senderEmail, contextText: body, subject: replySubject(context.subject) });
  }
  if (/\b(calendar|calendarul|kalender|adauga.*calendar|add.*calendar)\b/.test(value)) {
    const dateTime = context?.dateTimes[0];
    const parsedRequest = parseNaturalDateTime(raw);
    const epoch = parsedRequest ?? (dateTime ? Date.parse(dateTime) : Number.NaN);
    return resolved('CALENDAR', 'CALENDAR_INSERT_UI_ONLY', context && dateTime ? 'ACTIVE_GMAIL_CONTEXT' : 'REQUEST', { value: context?.subject || raw, startEpochMs: Number.isFinite(epoch) ? epoch : undefined });
  }
  if (/\b(distribuie|partajeaza|share|teilen)\b/.test(value)) {
    const shareText = context?.shareText || directValue(raw, /(?:distribuie|partajeaz[ăa]|share|teilen)\s+/i);
    return shareText ? resolved('SHARE', 'ANDROID_CHOOSER_REQUIRED', context?.shareText ? 'ACTIVE_GMAIL_CONTEXT' : 'REQUEST', { value: shareText, contextText: shareText, mimeType: 'text/plain' }) : unresolved('CLARIFICATION_REQUIRED', 'SHARE_PAYLOAD_REQUIRED');
  }
  if (/\b(sterge|delete|remove|wifi|bluetooth|setari sistem|system settings|instaleaza|uninstall)\b/.test(value)) return unresolved('UNSUPPORTED', 'ACTION_NOT_ALLOWLISTED');
  if (/\b(asistent|assistant|assistent)\b/.test(value)) return resolved('ASSISTANT', 'GENERAL_ASSISTANT_HANDOFF', 'GENERAL_HANDOFF', { contextText: raw });
  return unresolved('UNSUPPORTED', 'NO_ACTION_INTENT');
}

export function routeRetrievedAndroidAction(text: string, context: ActiveDriverContext): AndroidActionResolution | null {
  const value = normalize(text);
  const openRetrievedDestination = /\b(?:si deschide|and open|und offne)\b.*\b(?:adresa|address|adresse)\b/.test(value) || /\b(?:deschide|open|offne|navigheaza|navigate|navigiere)\b.*\b(?:adresa|address|adresse)\b/.test(value);
  if (!openRetrievedDestination) return null;
  const destination = context.destinations[0];
  const navigationApp = requestedNavigationApp(value);
  return destination ? resolved('NAVIGATION', 'GMAIL_DESTINATION_RESOLVED', 'ACTIVE_GMAIL_CONTEXT', { value: destination, ...(navigationApp ? { navigationApp } : {}) }) : unresolved('CLARIFICATION_REQUIRED', 'GMAIL_DESTINATION_NOT_FOUND');
}

export function parseNaturalDateTime(text: string, now = new Date()): number | undefined {
  const value = normalize(text);
  const relativeHours = /\b(?:peste|in)\s+(\d+|o|una|doua|doi|one|two|three|ein|eine|zwei|drei)\s+(?:ora|ore|hour|hours|stunde|stunden)\b/.exec(value);
  if (relativeHours) {
    const words: Record<string, number> = { o:1,una:1,one:1,ein:1,eine:1,doua:2,doi:2,two:2,zwei:2,three:3,drei:3 };
    const count = Number(relativeHours[1]) || words[relativeHours[1]!] || 0;
    if (count > 0) return now.getTime() + count * 3_600_000;
  }
  const clock = /\b(?:la|at|um)\s+(\d{1,2})(?:[:.](\d{2}))?\b/.exec(value);
  if (!clock) return undefined;
  const hour = Number(clock[1]); const minute = Number(clock[2] ?? 0);
  if (hour > 23 || minute > 59) return undefined;
  const target = new Date(now); target.setSeconds(0, 0);
  const tomorrow = /\b(?:maine|tomorrow|morgen)\b/.test(value);
  const weekdays: Record<string, number> = { duminica:0,sunday:0,sonntag:0,luni:1,monday:1,montag:1,marti:2,tuesday:2,dienstag:2,miercuri:3,wednesday:3,mittwoch:3,joi:4,thursday:4,donnerstag:4,vineri:5,friday:5,freitag:5,sambata:6,saturday:6,samstag:6 };
  const weekday = Object.entries(weekdays).find(([name]) => new RegExp(`\\b${name}\\b`).test(value));
  if (tomorrow) target.setDate(target.getDate() + 1);
  else if (weekday) { let days = (weekday[1] - target.getDay() + 7) % 7; if (days === 0) days = 7; target.setDate(target.getDate() + days); }
  target.setHours(hour, minute, 0, 0);
  if (!tomorrow && !weekday && target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
}

function requestedNavigationApp(value: string): AndroidActionPayload['navigationApp'] | undefined {
  const matches = [
    { app:'MAPS' as const,index:value.search(/\b(?:google maps|maps)\b/) },
    { app:'WAZE' as const,index:value.search(/\bwaze\b/) },
    { app:'TOMTOM' as const,index:value.search(/\b(?:tom tom|tomtom)\b/) },
  ].filter((entry) => entry.index >= 0).sort((left, right) => left.index - right.index);
  return matches[0]?.app;
}

function extractNavigationDestination(value: string) {
  const destination = directValue(value, /(?:navigheaz[ăa]|navigare|du[\s-]*m[ăa]|condu[\s-]*m[ăa]|mergi|navigate|route|navigiere|fahr(?:e)?)(?:\s+(?:la|c[ăa]tre|to|nach))?\s+/i);
  return destination.replace(/^[\s,.;:-]*(?:adresa|address|adresse)\s*[,:-]*\s*/i, '').trim();
}

function extractContactName(value: string) {
  const match = /(?:formeaz[ăa](?:\s+num[ăa]rul)?(?:\s+lui)?|sun[ăa](?:-l)?(?:\s+pe)?|apeleaz[ăa](?:-l)?(?:\s+pe)?|dial(?:\s+number)?(?:\s+for)?|call|anrufen|ruf)\s+(.+)/i.exec(value);
  if (!match) return '';
  const candidate = match[1]!.replace(/^(?:num[ăa]rul(?:\s+lui)?|num[ăa]r|lui|pe)\s+/i, '').replace(/[.!?,;:]+$/g, '').trim().slice(0, 120);
  const normalized = normalize(candidate);
  if (!normalized || /^(?:numarul|numar|number|telefon|phone)$/.test(normalized)) return '';
  if (/^\+?[0-9][0-9 ()\/-]{5,}[0-9]$/.test(candidate)) return '';
  return candidate;
}

function cleanContactName(value: string) {
  return value.replace(/[.!?,;:]+$/g, '').trim().slice(0, 120);
}

function directValue(value: string, prefix: RegExp) { const match = prefix.exec(value); return match ? value.slice(match.index + match[0].length).trim().replace(/[.!?]+$/, '').slice(0, 500) : ''; }
function replySubject(subject: string) { return /^re:/i.test(subject) ? subject : `Re: ${subject}`; }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+@.:-]+/g, ' ').trim(); }
