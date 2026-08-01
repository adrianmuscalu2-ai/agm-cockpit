export type DiagnosticsPlatform = 'browser' | 'android';

export interface SafeTechnicalDiagnostics {
  appVersion: string;
  build: string;
  phoneModel: string;
  androidVersion: string;
  connectionType: string;
}

export interface DiagnosticsPort {
  readonly platform: DiagnosticsPlatform;
  collect(): Promise<SafeTechnicalDiagnostics>;
}
