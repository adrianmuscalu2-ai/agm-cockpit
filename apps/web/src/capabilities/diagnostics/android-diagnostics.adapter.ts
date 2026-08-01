import { registerPlugin } from '@capacitor/core';
import type {
  DiagnosticsPort,
  SafeTechnicalDiagnostics,
} from './diagnostics.port';

interface AgmDiagnosticsPlugin {
  collect(): Promise<SafeTechnicalDiagnostics>;
}

const AgmDiagnostics = registerPlugin<AgmDiagnosticsPlugin>('AgmDiagnostics');

export function createAndroidDiagnosticsAdapter(): DiagnosticsPort {
  return {
    platform: 'android',
    collect: () => AgmDiagnostics.collect(),
  };
}
