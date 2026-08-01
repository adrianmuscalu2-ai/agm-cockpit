import {
  createIncident, emptyIncidentFilters, exportIncidentAudit, transitionIncident, updateIncident,
  type IncidentDraft, type IncidentJournalFilters, type OperationalIncident,
} from '../incident-journal';
import type { IncidentsState } from '../app-shell/app-state.contract';
import { reconcileIncidentJournal } from './incident-reconciliation';

export type IncidentControllerState = {
  incidents: OperationalIncident[];
  incidentFilters: IncidentJournalFilters;
  status: string;
};

export function createIncidentController(dependencies: {
  state: IncidentControllerState;
  incidentsState?: IncidentsState;
  render(): void;
  persist(): void;
  actor(): string;
}) {
  const { state } = dependencies;
  const incidents = dependencies.incidentsState ?? state;
  return {
    setFilters(filters: IncidentJournalFilters) {
      incidents.incidentFilters = filters;
      dependencies.render();
    },
    clearFilters() {
      incidents.incidentFilters = emptyIncidentFilters();
      dependencies.render();
    },
    reopen(id: string, note: string) {
      const incident = incidents.incidents.find((item) => item.id === id);
      if (!incident) return;
      const saved = transitionIncident(incident, 'reopened', dependencies.actor(), note);
      incidents.incidents = incidents.incidents.map((item) => item.id === saved.id ? saved : item);
      dependencies.persist();
      state.status = `Incident ${saved.id} redeschis și păstrat în istoric.`;
      dependencies.render();
      return saved;
    },
    save(draft: IncidentDraft, id: string, note: string) {
      const existing = incidents.incidents.find((item) => item.id === id);
      const saved = existing
        ? updateIncident(existing, draft, dependencies.actor(), note)
        : createIncident(draft, dependencies.actor());
      incidents.incidents = [saved, ...incidents.incidents.filter((item) => item.id !== saved.id)]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      dependencies.persist();
      state.status = `Incident ${saved.id} salvat în jurnal.`;
      dependencies.render();
      return saved;
    },
    reconcile(remoteIncidents: OperationalIncident[]) {
      const result = reconcileIncidentJournal(incidents.incidents, remoteIncidents);
      incidents.incidents = result.incidents;
      if (result.imported || result.updated) dependencies.persist();
      state.status = `Reconciliere API-006: ${result.imported} importate, ${result.updated} actualizate, ${result.heldForHumanValidation} în așteptarea validării umane.`;
      dependencies.render();
      return result;
    },
    exportAudit: () => exportIncidentAudit(incidents.incidents),
  };
}
