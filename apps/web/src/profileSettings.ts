import { type LanguageCode } from './emailLanguage';

export interface ProfileSettings {
  displayName: string;
  phone: string;
  email: string;
  company: string;
  preferredLanguage: LanguageCode;
  defaultSignature: string;
  drawnSignatureDataUrl: string;
}

export interface ProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const profileStorageKey = 'agm.profile.settings';
export const profileLanguageKey = 'agm.profile.preferredLanguage';

export function defaultProfile(): ProfileSettings {
  return {
    displayName: 'Operator A.G.M.',
    phone: '',
    email: '',
    company: '',
    preferredLanguage: 'ro',
    defaultSignature: 'Cu stima',
    drawnSignatureDataUrl: '',
  };
}

export function readProfile(storage: ProfileStorage): ProfileSettings {
  const storedProfile = storage.getItem(profileStorageKey);
  const legacyLanguage = readPreferredLanguage(storage);

  if (!storedProfile) {
    return {
      ...defaultProfile(),
      preferredLanguage: legacyLanguage,
    };
  }

  try {
    const parsed = JSON.parse(storedProfile) as Partial<ProfileSettings>;
    return {
      displayName: parsed.displayName || defaultProfile().displayName,
      phone: parsed.phone || '',
      email: parsed.email || '',
      company: parsed.company || '',
      preferredLanguage: normalizeLanguage(parsed.preferredLanguage) ?? legacyLanguage,
      defaultSignature: parsed.defaultSignature || defaultProfile().defaultSignature,
      drawnSignatureDataUrl: parsed.drawnSignatureDataUrl || '',
    };
  } catch {
    return {
      ...defaultProfile(),
      preferredLanguage: legacyLanguage,
    };
  }
}

export function saveProfile(storage: ProfileStorage, profile: ProfileSettings) {
  storage.setItem(profileStorageKey, JSON.stringify(profile));
  storage.setItem(profileLanguageKey, profile.preferredLanguage);
}

export function readPreferredLanguage(storage: ProfileStorage): LanguageCode {
  const stored = storage.getItem(profileLanguageKey);
  return normalizeLanguage(stored) ?? 'ro';
}

export function normalizeLanguage(value: unknown): LanguageCode | null {
  return value === 'en' || value === 'de' || value === 'ro' ? value : null;
}
