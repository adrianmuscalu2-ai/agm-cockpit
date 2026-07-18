import { Capacitor, registerPlugin } from '@capacitor/core';

interface AgmEmailPlugin {
  compose(options: { recipient: string; subject: string; body: string }): Promise<void>;
}

const AgmEmail = registerPlugin<AgmEmailPlugin>('AgmEmail');

export async function openEmailComposer(recipient: string, subject: string, body: string) {
  if (Capacitor.isNativePlatform()) {
    await AgmEmail.compose({ recipient, subject, body });
    return;
  }

  const query = new URLSearchParams({ subject, body });
  window.location.href = `mailto:${encodeURIComponent(recipient)}?${query.toString()}`;
}
