import { defaultApplicationAccessProfile, type ApplicationAccessProfile } from './application-access.types';
import { normalizeEntry } from './application-access.policy';

export const applicationAccessStorageKey = 'agm.profile.application-access.v1';

export interface ApplicationAccessStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeApplicationAccess(value: unknown): ApplicationAccessProfile {
  if (!value || typeof value !== 'object') return defaultApplicationAccessProfile();
  const candidate = value as Partial<ApplicationAccessProfile>;
  return {
    schemaVersion: 1,
    driverSafetyMode: candidate.driverSafetyMode === 'RESTRICTED' ? 'RESTRICTED' : 'NORMAL',
    entries: Array.isArray(candidate.entries)
      ? candidate.entries.filter((entry) => entry && typeof entry === 'object').slice(0,500).map((entry) => normalizeEntry(entry)).filter((entry) => entry.packageName && entry.appName)
      : [],
  };
}

export function readApplicationAccess(storage: ApplicationAccessStorage, fallback: ApplicationAccessProfile = defaultApplicationAccessProfile()): ApplicationAccessProfile {
  try {
    const value = storage.getItem(applicationAccessStorageKey);
    return value ? normalizeApplicationAccess(JSON.parse(value)) : normalizeApplicationAccess(fallback);
  } catch {
    return normalizeApplicationAccess(fallback);
  }
}

export function saveApplicationAccess(storage: ApplicationAccessStorage, profile: ApplicationAccessProfile): ApplicationAccessProfile {
  const normalized = normalizeApplicationAccess(profile);
  storage.setItem(applicationAccessStorageKey, JSON.stringify(normalized));
  return normalized;
}
