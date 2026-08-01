export const API006_TRACEABILITY_CONTRACT = {
  id: 'API-006',
  version: 'incidents-evidence-validation.v1',
  validationVersion: '2026.1',
  entities: {
    incident: 'IncidentReport',
    evidence: 'EvidenceMetadata',
    validationReport: 'BusinessValidationReport',
  },
  actions: {
    createIncident: 'create-incident-report',
    resolveIncident: 'resolve-incident-report',
    createEvidence: 'create-evidence-metadata',
  },
  requiredTraceFields: ['companyId', 'requestId', 'correlationId'] as const,
} as const;

