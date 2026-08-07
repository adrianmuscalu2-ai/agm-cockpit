export const SECRET_TELEMETRY_CONTRACT = {
  version: 'secret-telemetry.v1',
  guardianId: 'secret-credentials-guardian',
  monitorId: 'monitor-security',
  incidentId: 'AGM-SEC-SECRET-TELEMETRY',
} as const;

export type SecretMetadataStatus = 'CONFIGURED' | 'MISSING' | 'INVALID' | 'ROTATION REQUIRED';

export type SecretMetadata = {
  id: string;
  status: SecretMetadataStatus;
  provider: string;
  dependentService: string;
  environment: string;
  lastValidatedAt: string;
  incidentId: string | null;
};

export type SecretTelemetrySnapshot = {
  contract: typeof SECRET_TELEMETRY_CONTRACT.version;
  guardian: typeof SECRET_TELEMETRY_CONTRACT.guardianId;
  monitor: typeof SECRET_TELEMETRY_CONTRACT.monitorId;
  overallStatus: 'CONFIGURED' | 'ATTENTION';
  checkedAt: string;
  secrets: SecretMetadata[];
};
