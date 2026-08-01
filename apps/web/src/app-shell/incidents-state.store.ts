import type { IncidentsState, LegacyAppStateFacade } from './app-state.contract';

export function createIncidentsState(initial: IncidentsState): IncidentsState {
  return initial;
}

export const incidentsStateFields = [
  'incidents',
  'incidentFilters',
] as const satisfies readonly (keyof IncidentsState)[];

function setIncidentsField<Field extends keyof IncidentsState>(
  incidents: IncidentsState,
  field: Field,
  value: IncidentsState[Field],
) {
  incidents[field] = value;
}

export function attachIncidentsLegacyFacade<Base extends object>(
  base: Base,
  incidents: IncidentsState,
): Base & Pick<LegacyAppStateFacade, keyof IncidentsState> {
  for (const field of incidentsStateFields) {
    Object.defineProperty(base, field, {
      enumerable: true,
      configurable: false,
      get: () => incidents[field],
      set: (value: IncidentsState[typeof field]) => setIncidentsField(incidents, field, value),
    });
  }
  return base as Base & Pick<LegacyAppStateFacade, keyof IncidentsState>;
}
