import {
  type AdminIncidentCategory,
  type AdminIncidentReportV1,
  sanitizeAdminIncidentText,
} from './admin-incident-report.contract';

export type AdminReportModule = AdminIncidentCategory;

export interface SafeTechnicalDiagnostics {
  capturedAt: string;
  appVersion: string;
  build: string;
  phoneModel: string;
  androidVersion: string;
  connectionType: string;
  lastError: string;
}

export const TURN_REPORT_RECIPIENT = 'adrianmuscalu2@gmail.com';

export function adminReportModuleForView(view: string): AdminReportModule {
  if (view === 'cockpit') return 'Translator';
  if (view === 'email') return 'Mail';
  return 'Alt incident';
}

export function buildAdminBugSubject(module: AdminReportModule) {
  return `[AGM BUG ANDROID] ${module}`;
}

export function buildAdminBugReport(report: AdminIncidentReportV1) {
  return [
    `Contract: ${report.contractVersion}`,
    `ID incident: ${report.incidentId}`,
    `Sursă: ${report.source}`,
    `Categorie: ${report.category}`,
    `Descriere: ${report.description}`,
    `Data și ora: ${report.occurredAt}`,
    `Versiune aplicație: ${report.application.version}`,
    `Build: ${report.application.build}`,
    `Platformă: ${report.application.platform}`,
    `Model telefon: ${report.application.deviceModel}`,
    `Versiune Android: ${report.application.androidVersion}`,
    diagnosticLine('Internet', report.diagnostics.internet),
    diagnosticLine('API', report.diagnostics.api),
    diagnosticLine('AI', report.diagnostics.ai),
    diagnosticLine('Traducere', report.diagnostics.translation),
    `Ultimul mesaj de eroare: ${report.technical.lastError}`,
    'Pași pentru reproducere:',
    '',
    'Atașamente: adăugați manual capturile de ecran în aplicația de e-mail.',
    '',
    'Notă de confidențialitate: raportul nu include parole, tokenuri, chei API,',
    'conținutul mesajelor utilizatorului sau date personale sensibile.',
  ].join('\n');
}

export function sanitizeTechnicalError(value: unknown) {
  const text = value instanceof Error ? value.message : value;
  return sanitizeAdminIncidentText(text, 240) || 'Nicio eroare tehnică sigură înregistrată.';
}

function diagnosticLine(
  label: string,
  status: AdminIncidentReportV1['diagnostics']['internet'],
) {
  return `${label}: ${status.value} · ${status.freshness} · sursă ${status.source} · ${status.capturedAt ?? 'timestamp necunoscut'}`;
}
