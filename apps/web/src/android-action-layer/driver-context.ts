import type { ActiveDriverContext, GmailActionContext } from './android-action.contract';

const KEY = 'agm.driver.active-context.v1';
const TTL_MS = 30 * 60 * 1000;

export function rememberDriverContext(context: GmailActionContext, answerText: string, now = Date.now()) {
  const value: ActiveDriverContext = {
    ...context,
    answerText: answerText.trim().slice(0, 4000),
    capturedAtEpochMs: now,
    expiresAtEpochMs: now + TTL_MS,
  };
  sessionStorage.setItem(KEY, JSON.stringify(value));
  return value;
}

export function readDriverContext(now = Date.now()): ActiveDriverContext | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as ActiveDriverContext | null;
    if (!value || value.contractVersion !== 'gmail-action-context.v1' || value.expiresAtEpochMs <= now) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return value;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function clearDriverContext() {
  sessionStorage.removeItem(KEY);
}
