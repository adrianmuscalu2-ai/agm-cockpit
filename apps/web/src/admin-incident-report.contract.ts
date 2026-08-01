export const ADMIN_INCIDENT_REPORT_VERSION = 'admin-incident-report.v1' as const;

export const adminIncidentCategories = [
  'Translator',
  'AI',
  'API',
  'OCR',
  'Mail',
  'Alt incident',
] as const;

export type AdminIncidentCategory = (typeof adminIncidentCategories)[number];
export type AdminIncidentSource = 'android-diagnostics';
export type AdminDiagnosticState = 'online' | 'offline' | 'checking' | 'unknown';
export type AdminDiagnosticFreshness = 'current' | 'stale' | 'unknown';
export type AdminDiagnosticName = 'internet' | 'api' | 'ai' | 'translation';

export type AdminDiagnosticStatusV1 = {
  value: AdminDiagnosticState;
  freshness: AdminDiagnosticFreshness;
  source: string;
  capturedAt: string | null;
};

export type AdminIncidentReportV1 = {
  contractVersion: typeof ADMIN_INCIDENT_REPORT_VERSION;
  incidentId: string;
  source: AdminIncidentSource;
  category: AdminIncidentCategory;
  description: string;
  occurredAt: string;
  application: {
    version: string;
    build: string;
    platform: 'android';
    deviceModel: string;
    androidVersion: string;
  };
  diagnostics: Record<AdminDiagnosticName, AdminDiagnosticStatusV1>;
  technical: {
    lastError: string;
  };
};

export type AdminIncidentReportInput = Omit<
  AdminIncidentReportV1,
  'contractVersion' | 'incidentId' | 'description' | 'technical'
> & {
  description: unknown;
  lastError: unknown;
  incidentId?: string;
};

export function createAdminIncidentReportV1(
  input: AdminIncidentReportInput,
  createId: () => string = defaultIncidentId,
): AdminIncidentReportV1 {
  const description = sanitizeAdminIncidentText(input.description, 500);
  if (!description) throw new Error('ADMIN_INCIDENT_DESCRIPTION_REQUIRED');

  return {
    contractVersion: ADMIN_INCIDENT_REPORT_VERSION,
    incidentId: input.incidentId?.trim() || createId(),
    source: input.source,
    category: input.category,
    description,
    occurredAt: input.occurredAt,
    application: {
      version: sanitizeAdminIncidentText(input.application.version, 80) || 'unknown',
      build: sanitizeAdminIncidentText(input.application.build, 80) || 'unknown',
      platform: 'android',
      deviceModel: sanitizeAdminIncidentText(input.application.deviceModel, 120) || 'unknown',
      androidVersion: sanitizeAdminIncidentText(input.application.androidVersion, 80) || 'unknown',
    },
    diagnostics: input.diagnostics,
    technical: {
      lastError:
        sanitizeAdminIncidentText(input.lastError, 240) ||
        'No safe technical error was recorded.',
    },
  };
}

export function sanitizeAdminIncidentText(value: unknown, maximumLength = 500) {
  return String(value ?? '')
    .replace(/bearer\s+[a-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:key|token|secret|password|code)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(key|token|secret|password|code)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\b(?:sk|pk)-[a-z0-9_-]{12,}\b/gi, '[REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

export function createAdminDiagnosticStatus(
  value: AdminDiagnosticState,
  source: string,
  capturedAt: string | null,
  now: string,
  currentWindowMs = 90_000,
): AdminDiagnosticStatusV1 {
  if (!capturedAt) return { value: 'unknown', freshness: 'unknown', source, capturedAt: null };
  const age = Date.parse(now) - Date.parse(capturedAt);
  return {
    value,
    freshness:
      Number.isFinite(age) && age >= 0 && age <= currentWindowMs
        ? 'current'
        : 'stale',
    source,
    capturedAt,
  };
}

function defaultIncidentId() {
  return `AGM-INC-${crypto.randomUUID().toUpperCase()}`;
}
