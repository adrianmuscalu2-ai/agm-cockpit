export const storageKeys = {
  ocrHistory: 'agm.ocr.history.v1',
  tutorialCompletion: 'agm.tutorial.completed.v1',
  emailTutorialCompletion: 'agm.tutorial.email.completed.v1',
  roadmapInvitation: 'agm.roadmap.invitation.v1',
} as const;

export type Sr05StorageId = keyof typeof storageKeys;
export type StorageOwner = 'ocr' | 'guidance';
export type StorageRetention =
  | 'persistent-until-user-reset'
  | 'persistent-until-ocr-history-delete';
export type StorageResetScope = 'ocr-history-delete' | 'all-local-data';

export type StorageRegistryEntry = {
  readonly id: Sr05StorageId;
  readonly key: (typeof storageKeys)[Sr05StorageId];
  readonly schemaVersion: 1;
  readonly owner: StorageOwner;
  readonly retention: StorageRetention;
  readonly resetScopes: readonly StorageResetScope[];
};

export const sr05StorageRegistry = [
  {
    id: 'ocrHistory',
    key: storageKeys.ocrHistory,
    schemaVersion: 1,
    owner: 'ocr',
    retention: 'persistent-until-user-reset',
    resetScopes: ['ocr-history-delete', 'all-local-data'],
  },
  {
    id: 'tutorialCompletion',
    key: storageKeys.tutorialCompletion,
    schemaVersion: 1,
    owner: 'guidance',
    retention: 'persistent-until-ocr-history-delete',
    resetScopes: ['ocr-history-delete'],
  },
  {
    id: 'emailTutorialCompletion',
    key: storageKeys.emailTutorialCompletion,
    schemaVersion: 1,
    owner: 'guidance',
    retention: 'persistent-until-ocr-history-delete',
    resetScopes: ['ocr-history-delete'],
  },
  {
    id: 'roadmapInvitation',
    key: storageKeys.roadmapInvitation,
    schemaVersion: 1,
    owner: 'guidance',
    retention: 'persistent-until-ocr-history-delete',
    resetScopes: ['ocr-history-delete'],
  },
] as const satisfies readonly StorageRegistryEntry[];

export type AppStorageMedium = 'local' | 'session' | 'local-or-session';
export type AppStorageSensitivity = 'standard' | 'personal' | 'operational' | 'credential';

export type AppStorageRegistryEntry = {
  readonly id: string;
  readonly key: string;
  readonly owner: string;
  readonly medium: AppStorageMedium;
  readonly sensitivity: AppStorageSensitivity;
  readonly offlineReadable: boolean;
  readonly resetOwner: string;
};

/**
 * APP-009 governance inventory. Keys remain implemented and migrated by their
 * owning modules; this register prevents anonymous persistence and ownership
 * bypass without changing any established storage contract.
 */
export const app009StorageRegistry = [
  ...sr05StorageRegistry.map((entry) => ({
    id: entry.id,
    key: entry.key,
    owner: entry.owner,
    medium: entry.id === 'ocrHistory' ? 'session' as const : 'local' as const,
    sensitivity: entry.id === 'ocrHistory' ? 'personal' as const : 'standard' as const,
    offlineReadable: true,
    resetOwner: entry.owner,
  })),
  entry('profile', 'agm.profile.settings', 'APP-007', 'session', 'personal', true),
  entry('profileLanguage', 'agm.profile.preferredLanguage', 'APP-007', 'local', 'standard', true),
  entry('contacts', 'agm.contact-manager.contacts', 'APP-005', 'session', 'personal', true),
  entry('messageLibrary', 'agm.message-library.preferences.v1', 'APP-003', 'local', 'standard', true),
  entry('incidentJournal', 'agm.turn.incident-journal.v1', 'OPS-003', 'session', 'operational', true),
  entry('legalAcceptance', 'agm.legal.acceptance.{privacy}.{terms}', 'APP-014', 'local', 'standard', true),
  entry('adminSession', 'agm.admin.session', 'APP-013', 'session', 'credential', false),
  entry('authAccessToken', 'agm.auth.accessToken', 'API-003', 'session', 'credential', false),
  entry('preDepartureSession', 'agm.e6.pre-departure.session.v1', 'APP-001', 'session', 'operational', true),
  entry('preDepartureSyncMeta', 'agm.pre-departure.sync-meta.v1', 'APP-001', 'session', 'operational', true),
  entry('preDepartureOutbox', 'agm.pre-departure.outbox.v1', 'APP-001', 'session', 'operational', true),
  entry('preDepartureSyncAck', 'agm.pre-departure.sync-ack.v1', 'APP-001', 'session', 'operational', true),
  entry('preDepartureLanguage', 'agm.pre-departure.language', 'APP-008', 'local', 'standard', true),
  entry('afterDepartureLanguage', 'agm.poc02.language', 'APP-008', 'local', 'standard', true),
  entry('premiumDeviceId', 'agm.premium.device-id.v1', 'PREMIUM', 'session', 'operational', true),
  entry('premiumTripContext', 'agm.premium.trip-context.v1', 'PREMIUM', 'session', 'operational', true),
  entry('premiumOperationalEvents', 'agm.premium.operational-events.v1', 'PREMIUM', 'session', 'operational', true),
  entry('premiumOperationalOutbox', 'agm.premium.operational-outbox.v1', 'PREMIUM', 'session', 'operational', true),
] as const satisfies readonly AppStorageRegistryEntry[];

function entry(
  id: string,
  key: string,
  owner: string,
  medium: AppStorageMedium,
  sensitivity: AppStorageSensitivity,
  offlineReadable: boolean,
): AppStorageRegistryEntry {
  return { id, key, owner, medium, sensitivity, offlineReadable, resetOwner: owner };
}
