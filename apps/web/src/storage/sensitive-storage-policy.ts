export const sensitiveLegacyLocalKeys = [
  'agm.auth.rememberedEmail',
  'agm.profile.settings',
  'agm.contact-manager.contacts',
  'agm.ocr.history.v1',
  'agm.turn.incident-journal.v1',
  'agm.e6.pre-departure.session.v1',
  'agm.pre-departure.outbox.v1',
  'agm.pre-departure.sync-ack.v1',
  'agm.pre-departure.sync-meta.v1',
  'agm.poc02.after-departure.session.v1',
  'agm.premium.trip-context.v1',
  'agm.premium.operational-events.v1',
  'agm.premium.operational-outbox.v1',
  'agm.premium.operational-conflicts.v1',
  'agm.premium.operational-case.v1',
  'agm.premium.field-batch-01.v1',
  'agm.premium.field-batch-02.v1',
  'agm.premium.field-batch-02.safety.v1',
  'agm.premium.communication-timeline.v1',
  'agm.premium.single-copilot.state.v1',
  'agm.premium.voice.telemetry.v1',
  'agm.wave2b.communication-ledger.v1',
  'agm.wave2d.conversational-routing.v1',
] as const;

export function purgeSensitiveLegacyLocalStorage(storage: Pick<Storage,'removeItem'>) {
  for (const key of sensitiveLegacyLocalKeys) storage.removeItem(key);
}

export function bindSensitiveSessionCleanup(storage: Pick<Storage,'clear'>, target: Pick<Window,'addEventListener'> = window) {
  target.addEventListener('pagehide', () => storage.clear(), { once: true });
}
