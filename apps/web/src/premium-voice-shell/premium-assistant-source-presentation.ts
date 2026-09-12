import type { BasicLanguageCode } from '../language-registry';
import type { AssistantSourceTrace, PremiumAssistantClientResponse } from './premium-assistant.client';

type SourceCopy = {
  used: string;
  show: string;
  hide: string;
  library: string;
  live: string;
  cache: string;
  libraryAnswer: string;
  livePending: string;
  noSources: string;
  unavailable: string;
};

const english: SourceCopy = {
  used: 'Sources', show: 'Show', hide: 'Hide', library: 'Library', live: 'Live', cache: 'Cache',
  libraryAnswer: 'Answer based on the AGM Library',
  livePending: 'Live source verification in progress',
  noSources: 'No verified source attached',
  unavailable: 'Source details are temporarily unavailable',
};

const localized: Partial<Record<BasicLanguageCode, SourceCopy>> = {
  ro: {
    used: 'Surse', show: 'Afișează', hide: 'Ascunde', library: 'Library', live: 'Live', cache: 'Cache',
    libraryAnswer: 'Răspuns bazat pe biblioteca AGM',
    livePending: 'Sursă live în curs de verificare',
    noSources: 'Nicio sursă verificată atașată',
    unavailable: 'Detaliile surselor sunt temporar indisponibile',
  },
  de: {
    used: 'Quellen', show: 'Anzeigen', hide: 'Ausblenden', library: 'Bibliothek', live: 'Live', cache: 'Cache',
    libraryAnswer: 'Antwort basiert auf der AGM-Bibliothek',
    livePending: 'Live-Quelle wird überprüft',
    noSources: 'Keine verifizierte Quelle angehängt',
    unavailable: 'Quelldetails sind vorübergehend nicht verfügbar',
  },
};

export function sourceCopy(language: BasicLanguageCode): SourceCopy {
  return localized[language] ?? english;
}

export function compactSourceSummary(trace: Omit<AssistantSourceTrace, 'sources'>, language: BasicLanguageCode): string {
  const copy = sourceCopy(language);
  if (trace.status === 'LIVE_VERIFICATION_IN_PROGRESS') return copy.livePending;
  if (trace.status === 'NO_VERIFIED_SOURCES' || trace.counts.total === 0) return copy.noSources;
  const groups = [
    trace.counts.library > 0 ? `${copy.library} ${trace.counts.library}` : '',
    trace.counts.live > 0 ? `${copy.live} ${trace.counts.live}` : '',
    trace.counts.cache > 0 ? `${copy.cache} ${trace.counts.cache}` : '',
  ].filter(Boolean);
  return `${copy.used}: ${trace.counts.total}${groups.length ? ` · ${groups.join(' · ')}` : ''}`;
}

export type SourceLatencySnapshot = {
  timeToFirstTokenMs: number;
  timeToFirstAudioMs?: number;
  answerCompleteMs: number;
  sourcesVisibleMs?: number;
};

export class AssistantTurnLatencyTracker {
  private readonly startedAt: number;
  private server?: PremiumAssistantClientResponse['timing'];
  private audioAt?: number;
  private sourcesAt?: number;

  constructor(startedAt: number) { this.startedAt = startedAt; }
  acceptServer(timing: PremiumAssistantClientResponse['timing']) { this.server = timing; }
  markAudioStarted(at: number) { this.audioAt ??= at; }
  markSourcesVisible(at: number) { this.sourcesAt ??= at; }
  snapshot(): SourceLatencySnapshot {
    return {
      timeToFirstTokenMs: this.server?.timeToFirstTokenMs ?? 0,
      ...(this.audioAt === undefined ? {} : { timeToFirstAudioMs: Math.max(0, Math.round(this.audioAt - this.startedAt)) }),
      answerCompleteMs: this.server?.answerCompleteMs ?? 0,
      ...(this.sourcesAt === undefined ? {} : { sourcesVisibleMs: Math.max(0, Math.round(this.sourcesAt - this.startedAt)) }),
    };
  }
}

export function startAnswerAndSourcePresentation(
  startAudio: () => Promise<boolean>,
  presentSources: () => Promise<void>,
) {
  // Ordering is contractual: invoking audio first removes source formatting/fetching
  // from the critical path to first audio.
  const audio = startAudio();
  const sources = presentSources();
  return { audio, sources };
}
