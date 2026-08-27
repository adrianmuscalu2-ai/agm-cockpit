import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import type { RequestContext } from '../src/common/request-context';

async function main() {
  const prisma = new PrismaClient();
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('No local Company exists for runtime gate.');
  const user = await prisma.user.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: 'asc' } });
  if (!user) throw new Error('No local User exists for runtime gate.');
  const runId = `authority-gate-${Date.now()}`;
  const ctx: RequestContext = { companyId: company.id, userId: user.id, roles: ['OWNER'], requestId: randomUUID(), correlationId: randomUUID() };
  const service = new AuthorityControlPlaneService(prisma as never);
  try {
    const initial = await service.dashboard(ctx);
    assert(initial.nodes.length >= 19, 'canonical Premium registry is persisted');
    const guardianBefore = await prisma.authorityFailoverState.count({ where: { companyId: company.id, scopeId: 'premium.security.secrets' } });

    const parentMandate = await service.createMandate({ mandateKey: `${runId}-parent`, scopeId: 'premium.recovery', agentId: 'premium.recovery-executor', mode: 'EXECUTIVE', readSet: ['runbook.read'], writeSet: ['recovery.runbook.execute'], resourceSelectors: [], prohibitedActions: ['architecture.redesign', 'scope.expand', 'contract.change', 'guardian.takeover', 'critical-recovery.improvise'] }, ctx);
    const parentDecision = await service.createDecision({ decisionKey: `${runId}-decision`, mandateId: parentMandate.id, actionType: 'RECOVERY_RUNBOOK_EXECUTION', decision: { approved: true, runbookOnly: true } }, ctx);
    const lease = await service.issueLease({ leaseKey: `${runId}-lease-primary`, requestId: `${runId}-request-primary`, mandateId: parentMandate.id, decisionId: parentDecision.id, providerId: 'agm-runtime-primary', ttlSeconds: 900 }, ctx);
    assert(lease.epoch === lease.fencingToken, 'epoch and fencing token are issued persistently');
    await service.validateWrite({ leaseId: lease.id, epoch: lease.epoch, fencingToken: lease.fencingToken, command: 'recovery.runbook.execute', scopeId: 'premium.recovery' }, ctx);

    let staleRejected = false;
    try { await service.validateWrite({ leaseId: lease.id, epoch: lease.epoch - 1, fencingToken: lease.fencingToken - 1, command: 'recovery.runbook.execute', scopeId: 'premium.recovery' }, ctx); } catch { staleRejected = true; }
    assert(staleRejected, 'stale fencing response is rejected');

    const childMandate = await service.createMandate({ mandateKey: `${runId}-child`, scopeId: 'premium.recovery.telemetry', agentId: 'premium.recovery-executor', mode: 'EXECUTIVE', readSet: ['telemetry.read'], writeSet: ['recovery.runbook.execute'], resourceSelectors: [], prohibitedActions: ['scope.expand'] }, ctx);
    let collisionRejected = false;
    try { await service.issueLease({ leaseKey: `${runId}-lease-child`, requestId: `${runId}-request-child`, mandateId: childMandate.id, providerId: 'agm-runtime-primary', ttlSeconds: 900 }, ctx); } catch { collisionRejected = true; }
    assert(collisionRejected, 'parent/child executive scope collision is rejected');

    const handoff = await service.handoff({ previousLeaseId: lease.id, reason: 'runtime failover proof', leaseKey: `${runId}-lease-secondary`, requestId: `${runId}-request-secondary`, mandateId: parentMandate.id, decisionId: parentDecision.id, providerId: 'agm-runtime-secondary', ttlSeconds: 900 }, ctx);
    assert(handoff.epoch > lease.epoch && handoff.fencingToken > lease.fencingToken, 'handoff increments epoch and fencing token');
    const activeInScope = await prisma.authorityLease.count({ where: { companyId: company.id, scopeId: 'premium.recovery', state: { in: ['AUTHORIZED', 'ACTIVE', 'DRAINING'] }, expiresAt: { gt: new Date() } } });
    assert(activeInScope === 1, 'one scope has one active executive authority');

    const runbook = await prisma.recoveryRunbook.findFirstOrThrow({ where: { companyId: company.id, runbookKey: 'premium.telemetry.refresh', status: 'APPROVED' } });
    const recovery = await service.executeRecovery({ executionKey: `${runId}-recovery`, runbookId: runbook.id, mandateId: parentMandate.id, decisionId: parentDecision.id, authorityLeaseId: handoff.id, fencingToken: handoff.fencingToken, actions: ['telemetry.refresh'] }, ctx);
    assert(recovery.status === 'COMPLETED', 'Recovery Executor executes only an approved runbook');
    let improvisationRejected = false;
    try { await service.executeRecovery({ executionKey: `${runId}-improvised`, runbookId: runbook.id, mandateId: parentMandate.id, decisionId: parentDecision.id, authorityLeaseId: handoff.id, fencingToken: handoff.fencingToken, actions: ['architecture.redesign'] }, ctx); } catch { improvisationRejected = true; }
    assert(improvisationRejected, 'Recovery Executor rejects improvised actions');

    await service.revokeLease(handoff.id, 'runtime gate complete', ctx);
    let revokedRejected = false;
    try { await service.validateWrite({ leaseId: handoff.id, epoch: handoff.epoch, fencingToken: handoff.fencingToken, command: 'recovery.runbook.execute', scopeId: 'premium.recovery' }, ctx); } catch { revokedRejected = true; }
    assert(revokedRejected, 'revoked authority response is rejected');
    const guardianAfter = await prisma.authorityFailoverState.count({ where: { companyId: company.id, scopeId: 'premium.security.secrets' } });
    assert(guardianAfter === guardianBefore, 'Guardian is unaffected by executive failover');
    const journal = await prisma.authorityAuditJournal.findMany({ where: { companyId: company.id, safeMetadata: { path: ['reason'], equals: 'runtime failover proof' } } });
    assert(journal.length >= 2, 'revocation and handoff are auditable');
    console.log(JSON.stringify({ verdict: 'PASS', runId, persistedRegistryNodes: initial.nodes.length, epoch: lease.epoch, handoffEpoch: handoff.epoch, staleRejected, collisionRejected, recoveryBounded: improvisationRejected, guardianUnaffected: guardianAfter === guardianBefore, activeAuthorityAfterRevocation: await prisma.authorityLease.count({ where: { companyId: company.id, state: { in: ['AUTHORIZED', 'ACTIVE', 'DRAINING'] }, expiresAt: { gt: new Date() } } }) }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Authority runtime gate failed: ${message}`); }

void main();
