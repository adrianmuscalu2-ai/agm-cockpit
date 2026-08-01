import type {
  DiagnosticsPort,
  SafeTechnicalDiagnostics,
} from './diagnostics.port';

export function createBrowserDiagnosticsAdapter(): DiagnosticsPort {
  return {
    platform: 'browser',

    async collect(): Promise<SafeTechnicalDiagnostics> {
      return {
        appVersion: 'Web',
        build: 'web',
        phoneModel: 'Browser',
        androidVersion: 'Nu se aplică',
        connectionType: navigator.onLine ? 'online' : 'offline',
      };
    },
  };
}
