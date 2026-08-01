import { Prisma } from '@prisma/client';

import { ExecutedCheck } from '../validation-reports/validation-reports.service';

function createCheck(
  code: string,
  status: ExecutedCheck['status'],
  message: string,
): ExecutedCheck {
  return {
    code,
    severity: 'mandatory',
    status,
    executedAt: new Date().toISOString(),
    durationMs: 1,
    message,
    evidenceIds: undefined,
    relatedEntityType: undefined,
    relatedEntityId: undefined,
    details: undefined,
  };
}

export async function buildCloseTransportChecks(
  tx: Prisma.TransactionClient,
  transportId: string,
): Promise<ExecutedCheck[]> {
  const history = await tx.transportJobStateHistory.findMany({
    where: { transportJobId: transportId },
    select: { businessAction: true },
  });
  const actions = new Set(history.map((item) => item.businessAction));
  const ledgerCount = await tx.financialLedger.count({
    where: { transportJobId: transportId, entryType: 'payment' },
  });
  const auditCount = await tx.auditEvent.count({
    where: { transportJobId: transportId },
  });

  return [
    createCheck(
      'DELIVERY_INSPECTION_COMPLETED',
      actions.has('complete-delivery') ? 'passed' : 'failed',
      actions.has('complete-delivery')
        ? 'Delivery inspection is completed.'
        : 'Delivery inspection is missing.',
    ),
    createCheck(
      'REQUIRED_DOCUMENTS_SUBMITTED',
      actions.has('submit-documents') ? 'passed' : 'failed',
      actions.has('submit-documents')
        ? 'Required documents are submitted.'
        : 'Required documents are not submitted.',
    ),
    createCheck(
      'MANDATORY_EVIDENCE_PRESENT',
      'not_applicable',
      'Evidence upload architecture is not part of Milestone 2 runtime flow.',
    ),
    createCheck(
      'NO_UNRESOLVED_INCIDENTS',
      'not_applicable',
      'Incident records are not part of Milestone 2 runtime flow.',
    ),
    createCheck(
      'FINANCIAL_LEDGER_RECONCILED',
      ledgerCount > 0 ? 'passed' : 'failed',
      ledgerCount > 0
        ? 'Payment ledger entry exists.'
        : 'Payment ledger entry is missing.',
    ),
    createCheck(
      'REQUIRED_AUDIT_RECORDS_CREATED',
      auditCount > 0 ? 'passed' : 'failed',
      auditCount > 0
        ? 'Audit records exist for this transport.'
        : 'Audit records are missing.',
    ),
    createCheck(
      'AI_RECOMMENDATIONS_REVIEWED',
      'not_applicable',
      'No AI recommendations are part of Milestone 2.',
    ),
    createCheck(
      'HUMAN_APPROVALS_COMPLETED',
      'not_applicable',
      'No additional human approvals are configured for Milestone 2.',
    ),
  ];
}
