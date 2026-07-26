import type { PreDepartureSession } from './pre-departure.types';
import { openPreDepartureIssues } from './pre-departure.issue-management';
import { sha256Hex } from './pre-departure.sha256';

export const PRE_DEPARTURE_REPORT_VERSION = '1.0.0' as const;

export async function createPreDepartureFinalReport(
  session: PreDepartureSession,
  metadata: { clientSessionId: string; generatedAt?: string },
) {
  if (session.state !== 'CONFIRMED' && session.state !== 'CLOSED') {
    throw new Error('A final report requires a confirmed or closed session.');
  }
  if (!session.confirmation?.actorLabel.trim()) {
    throw new Error('Explicit user confirmation is required.');
  }
  if (openPreDepartureIssues(session).length) {
    throw new Error('A final report cannot be generated with open problems.');
  }
  const report = {
    reportVersion: PRE_DEPARTURE_REPORT_VERSION,
    clientSessionId: metadata.clientSessionId,
    generatedAt: metadata.generatedAt ?? new Date().toISOString(),
    outcome: 'READY_FOR_DEPARTURE' as const,
    state: session.state,
    language: session.language ?? 'ro',
    contexts: [...session.contexts],
    checks: session.applicableCheckIds.map((checkId) => ({
      checkId,
      answer: session.answers[checkId] ?? null,
    })),
    issueHistory: Object.values(session.issues ?? {}).map((issue) => ({ ...issue })),
    confirmation: { ...session.confirmation },
    notice: 'Operational self-declaration; not a qualified electronic signature.',
  };
  return {
    ...report,
    integrity: {
      algorithm: 'SHA-256' as const,
      digest: await sha256Hex(JSON.stringify(report)),
    },
  };
}

export function downloadPreDepartureReport(report: Awaited<ReturnType<typeof createPreDepartureFinalReport>>) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `agm-pre-departure-${report.clientSessionId}-${report.generatedAt.replace(/[:.]/g, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
