import { authenticatedApiFetch } from '../authenticated-api';

export type GuardianAuthorityState = 'AUTHORIZED' | 'DENIED' | 'REVOKED' | 'NOT_REQUIRED' | 'NOT_PROVEN' | 'UNAVAILABLE';
export type GuardianEvaluationRequest = {
  phase: 'REQUEST' | 'EXECUTION' | 'OBSERVATION';
  requestedCapability: string;
  requestedPermissionOrScope: string;
  requestor: string;
  reason: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  currentAuthority: GuardianAuthorityState;
  evidence: string;
};
export type GuardianEvaluation = GuardianEvaluationRequest & {
  contractVersion: 'permission-guardian.v1';
  requestDetected: true;
  decision: 'APPROVED' | 'DENIED' | 'NOT_PROVEN';
  authorityGranted: boolean;
  evidenceId: string;
  correlationId: string;
  reasonCode: string;
  timestamp: string;
};

export async function evaluatePermissionRequest(request: GuardianEvaluationRequest): Promise<GuardianEvaluation | null> {
  try {
    const response = await authenticatedApiFetch('/security/permission-guardian/evaluate', {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    });
    if (!response.ok) return null;
    const envelope = await response.json() as { data?: GuardianEvaluation };
    return envelope.data?.contractVersion === 'permission-guardian.v1' ? envelope.data : null;
  } catch {
    return null;
  }
}
