import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { UniversalLifecycleService } from '../src/universal-lifecycle/universal-lifecycle.service';

// Real PostgreSQL (non-Production) end-to-end of PRECHECK -> authorized execution -> POST_REVIEW -> closure.
// Refuses to run against anything but a loopback host to keep it away from Production.
const url = process.env.AGM_E2E_DATABASE_URL ?? '';
assert.ok(url, 'AGM_E2E_DATABASE_URL is required');
assert.ok(/@(127\.0\.0\.1|localhost):\d+\//.test(url), 'E2E_REFUSES_NON_LOOPBACK_DATABASE');

const prisma = new PrismaClient({ datasources: { db: { url } } });
const service = new UniversalLifecycleService(prisma as never);
const validatorId = 'independent-validator-automated-20261025';
const executorId = 'codex-implementer-machine-operational-truth-remediation';
const run = randomUUID().slice(0, 8);
const sessionId = `e2e-session-${run}`;
const mandateId = `e2e-mandate-${run}`;
const candidateRef = 'integration/agm-1.9.1-20261104';
const worktreeRef = '.worktrees/agm-191-integration';

async function main() {
  const registered = await prisma.$queryRawUnsafe<{ actor_id: string; status: string }[]>(`SELECT actor_id, status FROM agm_governance.actor_principals WHERE actor_id IN ($1,$2)`, validatorId, executorId);
  assert.equal(registered.length, 2, 'existing registered Governance actors are required (none are invented)');
  assert.ok(registered.every((row) => row.status === 'ACTIVE'));

  await assert.rejects(() => service.assertOperationalExecution(undefined, mandateId), /SESSION_ID_REQUIRED_FOR_OPERATIONAL_EXECUTION/);
  await assert.rejects(() => service.assertOperationalExecution(sessionId, mandateId), /SESSION_NOT_AUTHORIZED/);

  await service.createSessionStartRecord({ sessionId, protocolVersion: 'AGM_MANDATORY_SESSION_MANDATE_PROTOCOL', protocolRead: true, archiveInterrogated: true, librariansActivated: true, currentBaseline: candidateRef, canonicalSourcesLoaded: true, actorMatrixLoaded: true, worktreeRegistryLoaded: true, activeIncidentsLoaded: true, openMandatesLoaded: true, riskKnowledgeAvailable: true, actorId: executorId, environmentClass: 'CONTROLLED_LOCAL', evidenceRefs: ['e2e-lifecycle-postgres'] });

  const { assessment, protectionSet } = await service.createRiskPrecheck({ mandateId, verdict: 'ALLOW', baselineRefs: ['append-only lifecycle events'], predictedRisks: ['none beyond baseline'], candidateRef, worktreeRef, canonicalSourceRefs: ['origin/agm-canonical-20260820'], writerAuthorityRefs: [executorId], createdBy: executorId });
  assert.equal(assessment.phase, 'PRECHECK');

  await assert.rejects(() => service.assertOperationalExecution(sessionId, mandateId), /MANDATE_START_NOT_PERSISTED/);
  await service.createMandateStartRecord({ mandateId, sessionId, mandateRegistered: true, archiveSearchComplete: true, librarianHandoffComplete: true, precedentsLoaded: true, canonicalSourcesVerified: true, actorsVerified: true, worktreeVerified: true, dependencyReview: 'COMPLETE', riskPrecheck: 'ALLOW', snapshotRef: 'backup:agm-191-integration-20261104', executionAuthorized: true, actorRefs: [executorId, validatorId], riskAssessmentId: assessment.id, protectionSetId: protectionSet.id, evidenceRefs: ['e2e-lifecycle-postgres'] });
  assert.deepEqual(await service.assertOperationalExecution(sessionId, mandateId), { sessionId, mandateId, authorized: true });

  const common = { mandateId, technicalResult: 'PASS', independentValidation: 'PASS', riskPostReview: 'ALLOW', finalVerdict: 'PASS', incidentsUpdated: true, versionUpdated: true, cscPcrUpdated: true, eventLedgerUpdated: true, archiveUpdated: true, mandateClosed: true, validatorId, riskReviewerId: validatorId, evidenceRefs: ['e2e-lifecycle-postgres'] };
  await assert.rejects(() => service.createMandateEndRecord({ ...common, riskPostAssessmentId: assessment.id }), /RISK_POST_REVIEW_NOT_PERSISTED/);

  const post = await service.recordRiskPostReview({ mandateId, verdict: 'ALLOW', actualEffects: ['no regression observed'], missedRisks: [], falsePositives: [], newPrecedents: [], candidateRef, worktreeRef, actor: validatorId });
  assert.equal(post.phase, 'POST_REVIEW');
  await assert.rejects(() => service.createMandateEndRecord({ ...common, riskPostAssessmentId: post.id }), /REGRESSION_COMPARISON_BLOCKS_CLOSURE/);

  await service.recordRiskComparison({ mandateId, capability: 'append-only lifecycle events', beforeStatus: 'PRESERVED', afterStatus: 'PRESERVED', result: 'PASS', priority: 'P0', evidenceRef: 'e2e-lifecycle-postgres', actor: validatorId });
  const end = await service.createMandateEndRecord({ ...common, riskPostAssessmentId: post.id });
  assert.equal(end.mandateClosed, true);

  const events = await prisma.$queryRawUnsafe<{ event_type: string; event_digest: string; previous_digest: string | null }[]>(`SELECT "eventType" AS event_type, "eventDigest" AS event_digest, "previousDigest" AS previous_digest FROM "UniversalLifecycleEvent" WHERE "mandateId"=$1 OR "sessionId"=$2 ORDER BY "occurredAt"`, mandateId, sessionId).catch(() => []);
  const types = events.map((event) => event.event_type);
  for (const expected of ['SESSION_START_AUTHORIZED', 'RISK_REGRESSION_PRECHECK', 'MANDATE_START_AUTHORIZED', 'REGRESSION_POST_REVIEW', 'MANDATE_CLOSED']) assert.ok(types.includes(expected), `event ${expected} persisted`);

  const tampered = await prisma.$executeRawUnsafe(`UPDATE "UniversalLifecycleEvent" SET "eventType"='TAMPERED' WHERE "mandateId"=$1`, mandateId).then(() => false).catch(() => true);
  assert.ok(tampered, 'append-only trigger must reject UPDATE');

  console.log(JSON.stringify({ result: 'PASS', sessionId, mandateId, events: types, governanceDecision: 'NOT_EXECUTED: no Proposer/Approver identity registered (authority gate reserved to Turn Commander)' }, null, 2));
}

main().finally(() => prisma.$disconnect());
