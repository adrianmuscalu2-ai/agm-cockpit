import { registerPlugin } from '@capacitor/core';
import type { EmailHandoffRequest, HandoffPort, ShareHandoffRequest } from './handoff.port';

interface AgmEmailPlugin {
  compose(options: EmailHandoffRequest): Promise<void>;
  share(options: ShareHandoffRequest): Promise<void>;
}

const plugin = registerPlugin<AgmEmailPlugin>('AgmEmail');

export function createAndroidHandoffAdapter(): HandoffPort {
  return {
    platform: 'android',
    composeEmail: (request) => plugin.compose(request),
    share: (request) => plugin.share(request),
  };
}

