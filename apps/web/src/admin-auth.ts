const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const developmentApiBaseUrl = import.meta.env.DEV ? 'http://127.0.0.1:3000/api/v1' : undefined;
const apiBaseUrl = (env?.VITE_AGM_API_BASE_URL?.trim() || developmentApiBaseUrl)?.replace(/\/$/, '');
const localHostname = typeof window !== 'undefined' && ['127.0.0.1', 'localhost'].includes(window.location.hostname);
const preReleaseOpenAccess = env?.VITE_AGM_TURN_ACCESS_MODE?.trim().toLowerCase() === 'open-pre-release';

export const localAdministratorBypassActive = (import.meta.env.DEV && localHostname) || preReleaseOpenAccess;
export const localAdministratorSession: AdminSession = {
  accessToken: 'agm-local-development-access',
  expiresInSeconds: 86_400,
};

if (!apiBaseUrl) {
  throw new Error('VITE_AGM_API_BASE_URL is required outside development.');
}

export interface AdminSession {
  accessToken: string;
  expiresInSeconds: number;
}

async function request(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/turn-admin/${path}`, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Serviciul Turn nu a răspuns în 10 secunde. Verifică API-ul și conexiunea.');
    }
    throw new Error('Serviciul Turn nu este accesibil. Verifică API-ul și conexiunea.');
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({})) as { data?: unknown; message?: string };
  if (!response.ok) {
    if (response.status === 429) throw new Error('Prea multe încercări de Owner Access. Așteaptă fereastra indicată de server și încearcă o singură dată.');
    throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || 'Acces administrativ indisponibil.');
  }
  return payload.data;
}

export async function unlockAdministrator(pin: string): Promise<AdminSession> {
  if (localAdministratorBypassActive) return localAdministratorSession;
  const normalizedPin = pin.trim();
  if (!normalizedPin) throw new Error('Introdu PIN-ul administrativ.');
  return await request('unlock', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: normalizedPin }),
  }) as AdminSession;
}

export async function validateAdministrator(session: AdminSession): Promise<boolean> {
  if (localAdministratorBypassActive && session.accessToken === localAdministratorSession.accessToken) return true;
  try {
    await request('validate', { method: 'POST', headers: authorization(session) });
    return true;
  } catch { return false; }
}

export async function changeAdministratorPin(session: AdminSession, currentPin: string, newPin: string) {
  if (localAdministratorBypassActive) throw new Error('Schimbarea PIN-ului este dezactivată în modul local fără PIN.');
  await request('change-pin', {
    method: 'POST',
    headers: { ...authorization(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPin, newPin }),
  });
}

function authorization(session: AdminSession) {
  return { Authorization: `Bearer ${session.accessToken}` };
}
