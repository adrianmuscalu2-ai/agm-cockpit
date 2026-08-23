import { Capacitor } from '@capacitor/core';
import { authenticatedApiFetch } from './authenticated-api';

const androidHeartbeatIntervalMs = 30_000;
let androidHeartbeatBound = false;
let androidHeartbeatTimer: number | undefined;

export async function publishAndroidHeartbeat() {
  if (Capacitor.getPlatform() !== 'android' || document.visibilityState !== 'visible') return false;
  try {
    const response = await authenticatedApiFetch('/operations/components/android/heartbeat', {
      method: 'POST',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ONLINE',
        reason: 'HEARTBEAT_RECEIVED',
        detail: 'AGM Android foreground runtime',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function bindAndroidComponentHeartbeat() {
  if (androidHeartbeatBound || Capacitor.getPlatform() !== 'android') return;
  androidHeartbeatBound = true;
  const publish = () => { void publishAndroidHeartbeat(); };
  publish();
  androidHeartbeatTimer = window.setInterval(publish, androidHeartbeatIntervalMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') publish();
  });
}

export function stopAndroidComponentHeartbeatForTest() {
  if (androidHeartbeatTimer !== undefined) window.clearInterval(androidHeartbeatTimer);
  androidHeartbeatTimer = undefined;
  androidHeartbeatBound = false;
}
