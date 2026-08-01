import { Capacitor } from '@capacitor/core';
import { createAndroidDiagnosticsAdapter } from './android-diagnostics.adapter';
import { createBrowserDiagnosticsAdapter } from './browser-diagnostics.adapter';
import type {
  DiagnosticsPort,
  SafeTechnicalDiagnostics,
} from './diagnostics.port';

const browserDiagnostics = createBrowserDiagnosticsAdapter();
const androidDiagnostics = createAndroidDiagnosticsAdapter();

export function selectDiagnosticsPort(
  isNativePlatform: boolean,
  browserPort: DiagnosticsPort = browserDiagnostics,
  androidPort: DiagnosticsPort = androidDiagnostics,
) {
  return isNativePlatform ? androidPort : browserPort;
}

export function collectSafeTechnicalDiagnostics(): Promise<SafeTechnicalDiagnostics> {
  return selectDiagnosticsPort(Capacitor.isNativePlatform()).collect();
}

export function isNativeAndroidApp() {
  return Capacitor.getPlatform() === 'android';
}
