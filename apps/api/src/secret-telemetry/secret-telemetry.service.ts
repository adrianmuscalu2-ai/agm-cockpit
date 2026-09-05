import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SECRET_TELEMETRY_CONTRACT,
  type SecretMetadata,
  type SecretMetadataStatus,
  type SecretTelemetrySnapshot,
} from './secret-telemetry.contract';

type SafeSecretDefinition = {
  id: string;
  configKey: string;
  provider: string;
  dependentService: string;
  validateReference(value: string): boolean;
};

const placeholders = new Set(['secret', 'replace-me', 'change-me-in-development', '<redacted_required>']);

export const safeSecretDefinitions: SafeSecretDefinition[] = [
  { id: 'session-signing', configKey: 'JWT_SECRET', provider: 'AGM', dependentService: 'Auth / Turn sessions', validateReference: (value) => value.length >= 32 && !placeholders.has(value.toLowerCase()) },
  { id: 'database-connection', configKey: 'DATABASE_URL', provider: 'PostgreSQL', dependentService: 'AGM API / persistence', validateReference: (value) => /^postgres(?:ql)?:\/\//i.test(value) },
  { id: 'translation-provider', configKey: 'OPENAI_API_KEY', provider: 'OpenAI', dependentService: 'Translator', validateReference: (value) => value.length >= 20 && !placeholders.has(value.toLowerCase()) },
  { id: 'live-mobility-tomtom', configKey: 'TOMTOM_API_KEY', provider: 'TomTom', dependentService: 'Geocoding / Routing / Traffic adapters', validateReference: (value) => /^[A-Za-z0-9]+$/.test(value) && !placeholders.has(value.toLowerCase()) },
  { id: 'gmail-oauth-client', configKey: 'GMAIL_OAUTH_CLIENT_ID', provider: 'Google Gmail', dependentService: 'Gmail Intake', validateReference: (value) => value.endsWith('.apps.googleusercontent.com') },
  { id: 'gmail-oauth-client-secret', configKey: 'GMAIL_OAUTH_CLIENT_SECRET', provider: 'Google Gmail', dependentService: 'Gmail Intake', validateReference: (value) => value.length >= 16 && !placeholders.has(value.toLowerCase()) },
  { id: 'gmail-oauth-refresh', configKey: 'GMAIL_OAUTH_REFRESH_TOKEN', provider: 'Google Gmail', dependentService: 'Gmail Intake', validateReference: (value) => value.length >= 16 && !placeholders.has(value.toLowerCase()) },
  { id: 'turn-administration', configKey: 'AGM_TURN_ADMIN_PIN_HASH', provider: 'AGM', dependentService: 'Turn Command Center', validateReference: (value) => /^\$2[aby]\$\d{2}\$/.test(value) },
];

// Product Owner routing decision: HERE and TollGuru are archived, inactive,
// non-required and excluded from active health. Their adapters remain
// reversible code paths that still require a separate Owner authorization.
export const archivedOptionalSecretDefinitions: SafeSecretDefinition[] = [
  { id: 'live-mobility-here', configKey: 'HERE_API_KEY', provider: 'HERE', dependentService: 'Archived optional geocoding / routing / transit provider', validateReference: (value) => value.length >= 16 && !placeholders.has(value.toLowerCase()) },
  { id: 'live-mobility-tollguru', configKey: 'TOLLGURU_API_KEY', provider: 'TollGuru', dependentService: 'Archived optional toll provider', validateReference: (value) => value.length >= 16 && !placeholders.has(value.toLowerCase()) },
];

export function evaluateSecretMetadata(
  values: Record<string, string | undefined>,
  environment: string,
  checkedAt: string,
  rotationRequiredIds: ReadonlySet<string> = new Set(),
): SecretTelemetrySnapshot {
  const turnAccessMode = values.AGM_TURN_ADMIN_ACCESS_MODE?.trim().toLowerCase();
  const secrets: SecretMetadata[] = safeSecretDefinitions.map((definition) => {
    const value = values[definition.configKey]?.trim() ?? '';
    const intentionallyOpenPreRelease = definition.id === 'turn-administration' && turnAccessMode === 'open-pre-release';
    const status: SecretMetadataStatus = intentionallyOpenPreRelease
      ? 'CONFIGURED'
      : !value
      ? 'MISSING'
      : !definition.validateReference(value)
        ? 'INVALID'
        : rotationRequiredIds.has(definition.id)
          ? 'ROTATION REQUIRED'
          : 'CONFIGURED';
    return {
      id: definition.id,
      status,
      provider: definition.provider,
      dependentService: definition.dependentService,
      environment,
      lastValidatedAt: checkedAt,
      incidentId: status === 'CONFIGURED' ? null : SECRET_TELEMETRY_CONTRACT.incidentId,
    };
  });
  return {
    contract: SECRET_TELEMETRY_CONTRACT.version,
    guardian: SECRET_TELEMETRY_CONTRACT.guardianId,
    monitor: SECRET_TELEMETRY_CONTRACT.monitorId,
    overallStatus: secrets.every((item) => item.status === 'CONFIGURED') ? 'CONFIGURED' : 'ATTENTION',
    checkedAt,
    secrets,
  };
}

@Injectable()
export class SecretTelemetryService {
  constructor(private readonly config: ConfigService) {}

  snapshot(): SecretTelemetrySnapshot {
    const values = Object.fromEntries(safeSecretDefinitions.map(({ configKey }) => [configKey, this.config.get<string>(configKey)]));
    values.AGM_TURN_ADMIN_ACCESS_MODE = this.config.get<string>('AGM_TURN_ADMIN_ACCESS_MODE');
    const rotations = new Set((this.config.get<string>('AGM_SECRET_ROTATION_REQUIRED') ?? '').split(',').map((id) => id.trim()).filter(Boolean));
    return evaluateSecretMetadata(values, this.config.get<string>('NODE_ENV', 'development'), new Date().toISOString(), rotations);
  }
}
