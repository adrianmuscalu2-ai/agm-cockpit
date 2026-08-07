import { type LanguageCode } from './emailLanguage';

export interface ProfileSettings {
  displayName: string;
  phone: string;
  email: string;
  company: string;
  vehicleNumber: string;
  address: string;
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
export const maximumDrawnSignatureLength = 1_000_000;

export function defaultProfile(): ProfileSettings {
  return {
    displayName: 'Operator A.G.M.',
    phone: '',
    email: '',
    company: '',
    vehicleNumber: '',
    address: '',
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
    return normalizeProfile(parsed, legacyLanguage);
  } catch {
    return {
      ...defaultProfile(),
      preferredLanguage: legacyLanguage,
    };
  }
}

export function saveProfile(storage: ProfileStorage, profile: ProfileSettings): ProfileSettings {
  const normalized = normalizeProfile(profile);
  storage.setItem(profileStorageKey, JSON.stringify(normalized));
  storage.setItem(profileLanguageKey, normalized.preferredLanguage);
  return normalized;
}

export function normalizeProfile(
  profile: Partial<ProfileSettings>,
  fallbackLanguage: LanguageCode = 'ro',
): ProfileSettings {
  const defaults = defaultProfile();
  const displayName = normalizeText(profile.displayName);
  const defaultSignature = normalizeText(profile.defaultSignature);

  return {
    displayName: displayName || defaults.displayName,
    phone: normalizeText(profile.phone),
    email: normalizeText(profile.email),
    company: normalizeText(profile.company),
    vehicleNumber: normalizeText(profile.vehicleNumber),
    address: normalizeText(profile.address),
    preferredLanguage: normalizeLanguage(profile.preferredLanguage) ?? fallbackLanguage,
    defaultSignature: defaultSignature || defaults.defaultSignature,
    drawnSignatureDataUrl: normalizeDrawnSignature(profile.drawnSignatureDataUrl),
  };
}

export function normalizeDrawnSignature(value: unknown): string {
  if (typeof value !== 'string' || value.length > maximumDrawnSignatureLength) {
    return '';
  }

  return /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(value) ? value : '';
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function readPreferredLanguage(storage: ProfileStorage): LanguageCode {
  const stored = storage.getItem(profileLanguageKey);
  return normalizeLanguage(stored) ?? 'ro';
}

export function normalizeLanguage(value: unknown): LanguageCode | null {
  return value === 'en' || value === 'de' || value === 'ro' ? value : null;
}
