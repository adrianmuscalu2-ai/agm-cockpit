import { foldText } from './agmatcc.ledger';

export type AgmatccVoiceCommand =
  | { type: 'search'; query: string }
  | { type: 'play-last' }
  | { type: 'open-journal'; target: string }
  | { type: 'read-remote-journal' }
  | { type: 'none' };

const PREFIX = /^(?:agma|agmatcc)?\s*(?:comanda|comand)\s+/;

/**
 * Commands are recognized only with the explicit word "comandă" so ordinary dictation is never executed.
 * Only non-mutating actions are exposed; recording a note always needs the human confirmation button.
 */
export function parseAgmatccVoiceCommand(transcript: string): AgmatccVoiceCommand {
  const folded = foldText(transcript).trim();
  const match = PREFIX.exec(folded);
  if (!match) return { type: 'none' };
  const body = folded.slice(match[0].length).trim();
  let found: RegExpExecArray | null;
  if ((found = /^(?:cauta|cautare)\s+(.+)$/.exec(body))) return { type: 'search', query: found[1] };
  if (/^(?:reda|citeste)\s+(?:ultima|ultimul)/.test(body)) return { type: 'play-last' };
  if (/^(?:citeste|interogheaza|verifica)\s+jurnal(?:ul)?\s+(?:turn|server|operational)/.test(body)) return { type: 'read-remote-journal' };
  if ((found = /^deschide\s+(?:jurnal(?:ul)?\s+)?(.+)$/.exec(body))) return { type: 'open-journal', target: found[1] };
  return { type: 'none' };
}
