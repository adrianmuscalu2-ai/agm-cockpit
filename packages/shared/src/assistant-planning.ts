/** Planning is conversation only; this classifier never grants execution authority. */
export function needsConversationPlanning(text: string): boolean {
  const value = normalize(text);
  if (/\b(organizeaza|organizam|planifica|planificam|analizeaza|compara|prioritizeaza|organize|organise|analyze|analyse|compare|prioritize|plan|plane|organisiere|analysiere|vergleiche)\b/.test(value)) return true;
  const actions = value.match(/\b(trimite|scrie|raspunde|adauga|creeaza|programeaza|muta|suna|deschide|send|write|reply|add|create|schedule|move|call|open|sende|schreibe|erstelle|verschiebe|offne)\b/g) ?? [];
  return actions.length > 1 && /\b(si|apoi|dupa|and|then|after|und|danach)\b/.test(value);
}

export function isPersonalOrganizationRequest(text: string): boolean {
  return /\b(calendar|calendare|agenda|mesaje|mesajele|intalnire|intalniri|memento|messages|meeting|meetings|reminder|reminders|kalender|nachrichten|termin|termine)\b/.test(normalize(text));
}

export function assistantThinkingProfile(request: {
  confirmedText: string; task?: string; history?: ReadonlyArray<{ role: string; text: string }>;
}) {
  const text = normalize(request.confirmedText);
  if (request.task === 'DRAFT_REPLY') return { effort: 'low' as const, maxOutputTokens: 1536, planning: false };
  const followUp = /^(da|nu|bine|ok|muta|schimba|mai|atunci|yes|no|okay|move|change|instead|ja|nein|verschiebe)\b/.test(text);
  const planning = needsConversationPlanning(request.confirmedText)
    || (followUp && Boolean(request.history?.slice(-6).some(turn => turn.role === 'user' && needsConversationPlanning(turn.text))));
  if (planning) return { effort: 'medium' as const, maxOutputTokens: 2048, planning: true };
  if (/^(buna|salut|multumesc|merci|hello|hi|thanks|hallo|danke)[!.?\s]*$/.test(text)) {
    return { effort: 'none' as const, maxOutputTokens: 320, planning: false };
  }
  return { effort: 'low' as const, maxOutputTokens: 1024, planning: false };
}

function normalize(text: string) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
