const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const apiBaseUrl = (env?.VITE_AGM_API_BASE_URL?.trim() || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');

export interface AdminSession {
  accessToken: string;
  expiresInSeconds: number;
}

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}/turn-admin/${path}`, options);
  const payload = await response.json().catch(() => ({})) as { data?: unknown; message?: string };
  if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || 'Acces administrativ indisponibil.');
  return payload.data;
}

export async function unlockAdministrator(pin: string): Promise<AdminSession> {
  return await request('unlock', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
  }) as AdminSession;
}

export async function validateAdministrator(session: AdminSession): Promise<boolean> {
  try {
    await request('validate', { method: 'POST', headers: authorization(session) });
    return true;
  } catch { return false; }
}

export async function changeAdministratorPin(session: AdminSession, currentPin: string, newPin: string) {
  await request('change-pin', {
    method: 'POST',
    headers: { ...authorization(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPin, newPin }),
  });
}

function authorization(session: AdminSession) {
  return { Authorization: `Bearer ${session.accessToken}` };
}
