import assert from 'node:assert/strict';
import { UniversalLifecycleService } from '../src/universal-lifecycle/universal-lifecycle.service';

const events: unknown[] = [];
const assessment = { id: 'assessment-1', mandateId: 'mandate-1', verdict: 'ALLOW' };
const protectionSet = { id: 'protection-1', mandateId: 'mandate-1' };
const session = { id: 'session-row', sessionId: 'session-1', sessionAuthorized: true, invalidatedAt: null };
const mandate = { id: 'mandate-row', mandateId: 'mandate-1', sessionId: 'session-1', executionAuthorized: true, invalidatedAt: null };
const db = {
  universalSessionLifecycleRecord: { create: async ({ data }: any) => ({ id: 'session-row', ...data }), findUnique: async ({ where }: any) => where.sessionId === 'session-1' ? session : null },
  universalMandateLifecycleRecord: { create: async ({ data }: any) => ({ id: 'mandate-row', ...data }), findUnique: async ({ where }: any) => where.mandateId === 'mandate-1' ? mandate : null },
  universalMandateEndRecord: { create: async ({ data }: any) => ({ id: 'end-row', ...data }) },
  universalLifecycleEvent: { findFirst: async () => events.at(-1), create: async ({ data }: any) => { events.push(data); return data; } },
  riskKnowledgeAssessment: { create: async ({ data }: any) => ({ ...assessment, ...data }), findUnique: async ({ where }: any) => where.id === 'assessment-1' ? assessment : null },
  riskKnowledgeProtectionSet: { create: async ({ data }: any) => ({ ...protectionSet, ...data }), findUnique: async ({ where }: any) => where.id === 'protection-1' ? protectionSet : null },
  riskKnowledgeRecheck: { create: async ({ data }: any) => data },
  riskKnowledgeComparison: { create: async ({ data }: any) => data },
  riskKnowledgeOverride: { create: async ({ data }: any) => data },
};

const service = new UniversalLifecycleService(db as never);

async function main() {
  await service.createSessionStartRecord({ sessionId: 'session-1', protocolVersion: 'AGM_MANDATORY_SESSION_MANDATE_PROTOCOL', protocolRead: true, archiveInterrogated: true, librariansActivated: true, currentBaseline: 'local', canonicalSourcesLoaded: true, actorMatrixLoaded: true, worktreeRegistryLoaded: true, activeIncidentsLoaded: true, openMandatesLoaded: true, riskKnowledgeAvailable: true, actorId: 'owner', environmentClass: 'CONTROLLED_LOCAL', evidenceRefs: [] });
  await service.createMandateStartRecord({ mandateId: 'mandate-1', sessionId: 'session-1', mandateRegistered: true, archiveSearchComplete: true, librarianHandoffComplete: true, precedentsLoaded: true, canonicalSourcesVerified: true, actorsVerified: true, worktreeVerified: true, dependencyReview: 'PASS', riskPrecheck: 'ALLOW', snapshotRef: 'snapshot:1', executionAuthorized: true, actorRefs: {}, riskAssessmentId: 'assessment-1', protectionSetId: 'protection-1', evidenceRefs: [] });
  assert.deepEqual(await service.assertOperationalExecution('session-1', 'mandate-1'), { sessionId: 'session-1', mandateId: 'mandate-1', authorized: true });
  await assert.rejects(() => service.assertOperationalExecution(undefined, 'mandate-1'), /SESSION_ID_REQUIRED_FOR_OPERATIONAL_EXECUTION/);
  await assert.rejects(() => service.createMandateStartRecord({ mandateId: 'blocked', sessionId: 'missing', mandateRegistered: true, archiveSearchComplete: true, librarianHandoffComplete: true, precedentsLoaded: true, canonicalSourcesVerified: true, actorsVerified: true, worktreeVerified: true, dependencyReview: 'PASS', riskPrecheck: 'ALLOW', snapshotRef: 'snapshot:blocked', executionAuthorized: true, actorRefs: {}, riskAssessmentId: 'assessment-1', protectionSetId: 'protection-1', evidenceRefs: [] }), /SESSION_NOT_AUTHORIZED/);
  console.log('Universal lifecycle backend gates O/P/Q: PASS');
}

void main();
