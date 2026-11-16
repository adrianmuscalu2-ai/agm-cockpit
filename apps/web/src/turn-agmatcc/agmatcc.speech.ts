export type RecognitionResultEvent = { resultIndex?: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }> };
export function readRecognitionTranscript(event: RecognitionResultEvent) {
  // Browser result lists are array-like; they need not implement Symbol.iterator.
  const results = Array.from(event.results);
  return { text: results.map(result => result[0]?.transcript ?? '').join(' ').trim(),
    final: results.length && results.every(result => result.isFinal)
      ? results.map(result => result[0]?.transcript ?? '').join(' ').trim() : '' };
}

export function selectSpeechVoice<T extends { lang: string; default?: boolean }>(voices: readonly T[], language: string): T | undefined {
  const normalized = language.toLowerCase().replace('_', '-');
  return voices.find(voice => voice.lang.toLowerCase().replace('_', '-') === normalized)
    ?? voices.find(voice => voice.lang.toLowerCase().split(/[-_]/)[0] === normalized.split('-')[0]);
}

export async function waitForSpeechVoice(synthesis: SpeechSynthesis, language: string) {
  const available = selectSpeechVoice(synthesis.getVoices(), language);
  if (available) return available;
  await new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); synthesis.removeEventListener('voiceschanged', finish); resolve(); };
    const timer = setTimeout(finish, 1500);
    synthesis.addEventListener('voiceschanged', finish, { once: true });
  });
  return selectSpeechVoice(synthesis.getVoices(), language);
}

export function speechRecognitionFailure(code: string): string {
  const messages: Record<string, string> = {
    'not-allowed': 'Accesul la microfon este blocat. Permite microfonul pentru acest site.',
    'service-not-allowed': 'Serviciul de transcriere al browserului nu este permis.',
    'audio-capture': 'Microfonul nu este disponibil. Verifică dispozitivul de intrare.',
    'network': 'Serviciul de transcriere al browserului nu poate fi contactat.',
    'no-speech': 'Nu a fost detectată vorbire. Încearcă din nou aproape de microfon.',
    'language-not-supported': 'Serviciul de transcriere nu acceptă limba română.',
    'aborted': 'Ascultarea a fost oprită.',
  };
  return messages[code] ?? `Transcrierea a eșuat (${code}).`;
}
