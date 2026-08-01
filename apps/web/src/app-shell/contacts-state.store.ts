import type { ContactsState, LegacyAppStateFacade } from './app-state.contract';

export function createContactsState(initial: ContactsState): ContactsState {
  return initial;
}

export const contactsStateFields = [
  'contacts',
  'contactManagerOpen',
  'contactSearch',
  'contactEditingId',
  'contactDraft',
  'contactErrors',
] as const satisfies readonly (keyof ContactsState)[];

function setContactsField<Field extends keyof ContactsState>(
  contacts: ContactsState,
  field: Field,
  value: ContactsState[Field],
) {
  contacts[field] = value;
}

export function attachContactsLegacyFacade<Base extends object>(
  base: Base,
  contacts: ContactsState,
): Base & Pick<LegacyAppStateFacade, keyof ContactsState> {
  for (const field of contactsStateFields) {
    Object.defineProperty(base, field, {
      enumerable: true,
      configurable: false,
      get: () => contacts[field],
      set: (value: ContactsState[typeof field]) => setContactsField(contacts, field, value),
    });
  }
  return base as Base & Pick<LegacyAppStateFacade, keyof ContactsState>;
}
