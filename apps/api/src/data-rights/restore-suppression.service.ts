import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import {
  effectiveActions,
  ledgerKey,
  readVerifiedLedger,
  subjectPseudonym,
  type SuppressionAction,
  type SuppressionLedgerRecord,
} from './suppression-ledger';

type RestoreUser = { id: string; companyId: string; status: string; personalDataStatus: string };
type RestoreResult = { eventId: string; action: SuppressionAction; status: 'SUBJECT_ABSENT' | 'APPLIED' };
type IndexedReference = { sourceTable: string; sourceColumn: string; matchKind: string; records: number };

export async function applyRestoreSuppressions(prisma: PrismaClient, env: Record<string, string | undefined>) {
  const path = env.DSAR_SUPPRESSION_LEDGER_PATH;
  if (!path) throw new Error('SUPPRESSION_LEDGER_PATH_MISSING');
  const key = ledgerKey(env.DSAR_SUPPRESSION_LEDGER_KEY);
  const records = await readVerifiedLedger(path, key);
  const actions = effectiveActions(records);
  const users: RestoreUser[] = await prisma.user.findMany({
    select: { id: true, companyId: true, status: true, personalDataStatus: true },
  });
  const results: RestoreResult[] = [];

  for (const action of actions) {
    const user = users.find((candidate) => subjectPseudonym(candidate.companyId, candidate.id, key) === action.subjectPseudonym);
    if (!user) {
      results.push({ eventId: action.eventId, action: action.action, status: 'SUBJECT_ABSENT' });
      continue;
    }
    const anonymous = `suppressed-${createHash('sha256').update(action.subjectPseudonym).digest('hex').slice(0, 24)}@deleted.invalid`;
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.authSession.updateMany({ where: { userId: user.id, companyId: user.companyId, revokedAt: null }, data: { revokedAt: new Date(action.effectiveAt) } });
      if (action.action === 'DELETE' || action.action === 'ANONYMIZE') {
        await tx.authSession.deleteMany({ where: { userId: user.id, companyId: user.companyId } });
        await tx.userRole.deleteMany({ where: { userId: user.id, companyId: user.companyId } });
        await tx.communicationMessage.updateMany({ where: { createdByUserId: user.id, companyId: user.companyId }, data: { fromAddress: anonymous, toAddress: anonymous, subject: null, bodyText: '[deleted]', createdByUserId: null, metadata: { anonymized: true, restoreSuppression: true } } });
        await tx.evidenceMetadata.updateMany({ where: { uploadedByUserId: user.id, companyId: user.companyId }, data: { originalFileName: null, description: null, metadata: { anonymized: true, restoreSuppression: true } } });
        await tx.user.update({ where: { id: user.id }, data: { displayName: 'Deleted user', email: anonymous, phoneNumber: null, passwordHash: 'ACCOUNT_DELETED', status: 'Deleted', personalDataStatus: 'Anonymized', anonymizedAt: new Date(action.effectiveAt), lastLoginAt: null } });
      } else {
        await tx.user.update({ where: { id: user.id }, data: { status: 'Restricted', personalDataStatus: action.action === 'PARTIAL_LEGAL_RESTRICTION' ? 'DeletionRestricted' : 'ProcessingRestricted' } });
      }
    });
    results.push({ eventId: action.eventId, action: action.action, status: 'APPLIED' });
    if (env.DSAR_SUPPRESSION_FAIL_AFTER && results.length === Number(env.DSAR_SUPPRESSION_FAIL_AFTER)) throw new Error('SYNTHETIC_PARTIAL_RESTORE_FAILURE');
  }

  const indexed = await verifyIndexedReferences(prisma, users, actions, key);
  return {
    contract: 'agm-restore-suppression-proof.v1',
    runId: randomUUID(),
    ledgerSha256: createHash('sha256').update(JSON.stringify(records)).digest('hex'),
    records: records.length,
    effectiveActions: actions.length,
    results,
    indexed,
    completedAt: new Date().toISOString(),
    status: 'PASS',
  };
}

async function verifyIndexedReferences(prisma: PrismaClient, users: RestoreUser[], actions: SuppressionLedgerRecord[], key: Buffer) {
  const output: Array<{ subjectPseudonym: string; references: IndexedReference[]; status: 'VERIFIED' }> = [];
  for (const action of actions) {
    const user = users.find((candidate) => subjectPseudonym(candidate.companyId, candidate.id, key) === action.subjectPseudonym);
    if (!user) continue;
    const rows = await prisma.$queryRawUnsafe<IndexedReference[]>('SELECT "sourceTable","sourceColumn","matchKind",count(*)::int AS records FROM "SubjectDataIndex" WHERE "subjectId"=$1::uuid GROUP BY 1,2,3 ORDER BY 1,2', user.id);
    const current = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true, personalDataStatus: true, email: true, displayName: true } });
    const suppressed = action.action === 'DELETE' || action.action === 'ANONYMIZE'
      ? current?.personalDataStatus === 'Anonymized' && current.email.endsWith('@deleted.invalid') && current.displayName === 'Deleted user'
      : current?.status === 'Restricted';
    if (!suppressed) throw new Error('RESTORE_SUPPRESSION_POSTCONDITION_FAILED');
    output.push({ subjectPseudonym: action.subjectPseudonym.slice(0, 16), references: rows, status: 'VERIFIED' });
  }
  return output;
}
