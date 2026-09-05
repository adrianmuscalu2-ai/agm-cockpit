export const OPERATIONAL_INCIDENT_CONTRACT = 'turn-operational-incident-pipeline.v1';

export type OperationalIncidentInput = {
  canonicalId: string;
  status: string;
  runtimeMode: string;
  runtimePresence: string;
  workloadState: string;
  dependencyState: string;
  dependencyFailures: string[];
  reason: string | null;
  evidenceReference: string | null;
  evaluatedAt: Date;
};

export type OperationalIncidentQualification = {
  decision: 'QUALIFIED' | 'NOT_REQUIRED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NONE';
  reasonCode: string;
  rootCauseClassification: 'REAL_DEFECT' | 'ABSENT_DEPENDENCY' | 'INTENTIONALLY_UNAVAILABLE_CONFIG' | 'FEATURE_NOT_ACTIVE' | 'RUNTIME_FAILURE' | 'UNKNOWN_CAPABILITY';
  rationale: string;
  evaluatedAt: Date;
  evidenceReference: string | null;
};

export function qualifyOperationalIncident(input: OperationalIncidentInput): OperationalIncidentQualification {
  const base = { evaluatedAt: input.evaluatedAt, evidenceReference: input.evidenceReference };
  const configurationAbsent = input.dependencyFailures.some((failure) => /NOT_CONFIGURED|UNCONFIGURED|MISSING_CONFIG/i.test(failure));
  const requestDrivenIdle = input.runtimeMode === 'REQUEST_DRIVEN' && input.workloadState === 'IDLE';

  if (['PASS', 'STANDBY'].includes(input.status)) {
    return { ...base, decision: 'NOT_REQUIRED', severity: 'NONE', reasonCode: 'HEALTHY_OR_READY_IDLE', rootCauseClassification: 'FEATURE_NOT_ACTIVE', rationale: 'Runtime-ul este sănătos sau pregătit/idle; nu există o condiție de incident.' };
  }
  if (requestDrivenIdle && configurationAbsent) {
    return { ...base, decision: 'NOT_REQUIRED', severity: 'NONE', reasonCode: 'CONDITIONAL_PROVIDER_INACTIVE', rootCauseClassification: 'INTENTIONALLY_UNAVAILABLE_CONFIG', rationale: 'Providerul lipsește, dar capabilitatea request-driven nu are workload activ; starea rămâne vizibilă fără incident fals.' };
  }
  if (requestDrivenIdle && ['DEGRADED', 'NO_TELEMETRY'].includes(input.status)) {
    return { ...base, decision: 'NOT_REQUIRED', severity: 'NONE', reasonCode: 'REQUEST_DRIVEN_NO_ACTIVE_WORKLOAD', rootCauseClassification: 'FEATURE_NOT_ACTIVE', rationale: 'Capabilitatea request-driven nu procesează lucru acum; lipsa activității nu este incident.' };
  }
  if (input.runtimeMode === 'EVENT_DRIVEN' && input.workloadState === 'IDLE' && input.status === 'NO_TELEMETRY') {
    return { ...base, decision: 'NOT_REQUIRED', severity: 'NONE', reasonCode: 'EVENT_DRIVEN_NO_ACTIVE_WORKLOAD', rootCauseClassification: 'FEATURE_NOT_ACTIVE', rationale: 'Niciun eveniment nu solicită această capabilitate; NO TELEMETRY este explicit, dar nu califică un incident.' };
  }
  if (input.status === 'FAIL') {
    const missingCapability = input.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED';
    return { ...base, decision: 'QUALIFIED', severity: missingCapability ? 'HIGH' : 'CRITICAL', reasonCode: missingCapability ? 'REQUIRED_CAPABILITY_NOT_IMPLEMENTED' : 'RUNTIME_FAILURE', rootCauseClassification: missingCapability ? 'REAL_DEFECT' : 'RUNTIME_FAILURE', rationale: input.reason ?? 'Evaluatorul operațional a confirmat o stare FAILED.' };
  }
  if (input.status === 'DEGRADED') {
    return { ...base, decision: 'QUALIFIED', severity: 'MEDIUM', reasonCode: configurationAbsent ? 'REQUIRED_DEPENDENCY_NOT_CONFIGURED' : 'DEGRADED_RUNTIME_OR_DEPENDENCY', rootCauseClassification: configurationAbsent ? 'ABSENT_DEPENDENCY' : 'RUNTIME_FAILURE', rationale: input.reason ?? 'Evaluatorul operațional a confirmat degradarea runtime/dependency.' };
  }
  return { ...base, decision: 'QUALIFIED', severity: 'HIGH', reasonCode: 'REQUIRED_TELEMETRY_UNKNOWN', rootCauseClassification: 'UNKNOWN_CAPABILITY', rationale: input.reason ?? 'Starea operațională nu poate fi stabilită pentru o capabilitate relevantă.' };
}

export function operationalIncidentTransition(
  qualification: OperationalIncidentQualification,
  latestEventType: string | null,
): 'OPERATIONAL_INCIDENT_OPENED' | 'OPERATIONAL_INCIDENT_RESOLVED' | null {
  const currentlyOpen = latestEventType === 'OPERATIONAL_INCIDENT_OPENED';
  if (qualification.decision === 'QUALIFIED' && !currentlyOpen) return 'OPERATIONAL_INCIDENT_OPENED';
  if (qualification.decision === 'NOT_REQUIRED' && currentlyOpen) return 'OPERATIONAL_INCIDENT_RESOLVED';
  return null;
}
