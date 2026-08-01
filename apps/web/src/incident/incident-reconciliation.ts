import type { IncidentHistoryEntry, OperationalIncident } from '../incident-journal';

export const incidentReconciliationContract = {
  id: 'APP-010',
  version: 'incident-journal-reconciliation.v1',
  remoteAuthority: 'API-006',
  terminalStatuses: ['validated', 'archived'] as const,
  heldStatus: 'ready-test',
} as const;

export type IncidentReconciliationResult = {
  incidents: OperationalIncident[];
  imported: number;
  updated: number;
  localWins: number;
  heldForHumanValidation: number;
};

export function reconcileIncidentJournal(
  localIncidents: OperationalIncident[],
  remoteIncidents: OperationalIncident[],
  now = new Date(),
): IncidentReconciliationResult {
  const byId = new Map(localIncidents.map((incident) => [incident.id, incident]));
  let imported = 0;
  let updated = 0;
  let localWins = 0;
  let heldForHumanValidation = 0;

  for (const remote of remoteIncidents) {
    const local = byId.get(remote.id);
    if (local && local.updatedAt >= remote.updatedAt) {
      localWins += 1;
      continue;
    }

    let candidate = { ...remote, history: mergeHistory(local?.history ?? [], remote.history) };
    const remoteIsTerminal = incidentReconciliationContract.terminalStatuses.includes(remote.status as 'validated' | 'archived');
    const locallyApproved = local?.status === 'validated' || local?.status === 'archived';
    if (remoteIsTerminal && !locallyApproved) {
      candidate = holdForHumanValidation(candidate, local?.status, now);
      heldForHumanValidation += 1;
    }

    byId.set(candidate.id, candidate);
    if (local) updated += 1;
    else imported += 1;
  }

  return {
    incidents: Array.from(byId.values()).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    imported,
    updated,
    localWins,
    heldForHumanValidation,
  };
}

function holdForHumanValidation(incident: OperationalIncident, fromStatus: OperationalIncident['status'] | undefined, now: Date) {
  const at = now.toISOString();
  return {
    ...incident,
    status: incidentReconciliationContract.heldStatus,
    updatedAt: at,
    history: [
      ...incident.history,
      {
        at,
        action: 'reconciliation-held',
        actor: incidentReconciliationContract.remoteAuthority,
        ...(fromStatus ? { fromStatus } : {}),
        toStatus: incidentReconciliationContract.heldStatus,
        note: 'Validarea sau arhivarea primită din API necesită confirmare umană în Incident Journal.',
      },
    ],
  } satisfies OperationalIncident;
}

function mergeHistory(local: IncidentHistoryEntry[], remote: IncidentHistoryEntry[]) {
  const entries = new Map<string, IncidentHistoryEntry>();
  for (const entry of [...local, ...remote]) {
    entries.set([entry.at, entry.action, entry.actor, entry.toStatus, entry.note].join('|'), entry);
  }
  return Array.from(entries.values()).sort((a, b) => a.at.localeCompare(b.at));
}

