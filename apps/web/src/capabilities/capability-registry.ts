import { diagnosticsCapabilityMatrix } from './diagnostics/diagnostics.capability';
import { handoffCapabilityMatrix } from './handoff/handoff.capability';

export const platformCapabilityRegistry = {
  diagnostics: {
    owner: 'APP-015',
    boundary: 'ported',
    matrix: diagnosticsCapabilityMatrix,
  },
  handoff: {
    owner: 'APP-015',
    boundary: 'ported',
    matrix: handoffCapabilityMatrix,
  },
  clipboard: {
    owner: 'APP-015',
    boundary: 'helper',
    adapters: ['browser-clipboard', 'dom-fallback'],
  },
  audio: {
    owner: 'APP-015',
    boundary: 'legacy-facade',
    adapters: ['agm-audio-plugin', 'browser-speech'],
  },
  cameraOcr: {
    owner: 'APP-015',
    boundary: 'consumer-managed',
    adapters: ['browser-file-capture', 'android-webview-file-capture'],
  },
} as const;

