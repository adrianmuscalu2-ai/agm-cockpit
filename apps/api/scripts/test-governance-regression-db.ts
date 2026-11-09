import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { GovernanceV2Persistence } from '../src/governance-v2/governance-v2.persistence';
import { GovernanceV2RuntimeService } from '../src/governance-v2/governance-v2.runtime';

// Only a newly created disposable local database or this exact isolated CI service.
// Never reads a configured application DATABASE_URL and never uses Production.
async function main() {
  const root = path.resolve(__dirname, '../../..');
  const container = `agm-governance-regression-${randomUUID()}`;
  const password = randomBytes(24).toString('hex');
  let started = false;
  let prisma: PrismaClient | undefined;
  let stage = 'CREATE_DISPOSABLE_DATABASE';
  try {
    let url = process.env.AGM_GOVERNANCE_TEST_DATABASE_URL;
    if (url) {
      const target = new URL(url);
      assert.equal(process.env.GITHUB_ACTIONS, 'true', 'SERVICE_DATABASE_REQUIRES_ISOLATED_CI');
      assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
      assert.equal(target.pathname, '/agm_governance_test');
      assert.equal(target.username, 'agm_governance_test');
    } else {
      started = true;
      execFileSync('docker', ['run', '--pull=never', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=agm_governance_test', '-e', 'POSTGRES_DB=agm_governance_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine'], { env: { ...process.env, POSTGRES_PASSWORD: password }, stdio: 'pipe', timeout: 90000 });
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        try { execFileSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'agm_governance_test'], { stdio: 'pipe', timeout: 5000 }); ready = true; break; }
        catch { await new Promise(resolve => setTimeout(resolve, 500)); }
      }
      assert.ok(ready, 'DISPOSABLE_DATABASE_NOT_READY');
      const port = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8', timeout: 15000 }).trim();
      assert.match(port, /^127\.0\.0\.1:\d+$/);
      url = `postgresql://agm_governance_test:${password}@${port}/agm_governance_test`;
    }
    const target = new URL(url);
    target.searchParams.set('connection_limit', '4');
    url = target.toString();
    stage = 'MIGRATE_DISPOSABLE_DATABASE';
    execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(root, 'prisma/schema.prisma')], { cwd: root, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', timeout: 90000 });
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const db = prisma;
    const persistence = new GovernanceV2Persistence(db as never);
    const runtime = new GovernanceV2RuntimeService(persistence);
    const denies = (work: () => Promise<unknown>, code: string) => assert.rejects(work, (error: Error) => error.message.includes(code));
    const now = new Date().toISOString();
    const proposal = (proposalId: string) => ({ proposalId, semanticTitle: proposalId, description: 'isolated concurrency fixture', scope: 'test', proposalType: 'TEST', proposerId: 'regression-proposer', createdAt: now, updatedAt: now, candidateRef: 'regression-candidate', candidateDigest: 'test-digest', baseRevision: 'base', affectedComponents: ['A', 'B'], affectedFacts: [], correlationId: randomUUID(), status: 'DRAFT' as const, evidenceRefs: [], riskAssessmentRefs: [], impactStudyRef: 'study', dependencyGraphRef: 'graph', snapshotRef: 'snapshot', pcrRefs: [], cscRefs: [] });
    const actors = [
      { id: 'regression-proposer', roles: ['PROPOSER' as const], canPropose: true, canValidate: false, canExecute: false },
      { id: 'regression-approver', roles: ['APPROVER' as const], canPropose: false, canValidate: false, canExecute: false },
      { id: 'regression-validator', roles: ['VALIDATOR' as const], canPropose: false, canValidate: true, canExecute: false },
      { id: 'regression-executor', roles: ['EXECUTOR' as const], canPropose: false, canValidate: false, canExecute: true },
    ];
    for (const actor of actors) await runtime.registerGovernanceActor({ ...actor, displayName: actor.id, status: 'ACTIVE' });

    stage = 'PINNED_CONNECTION_AND_CONCURRENCY';
    const connectionIds = await Promise.all(Array.from({ length: 8 }, () => persistence.transaction(async tx => {
      const before = await tx.$queryRawUnsafe<{ pid: number }>('SELECT pg_backend_pid()::int AS pid');
      await runtime.listProposals();
      const after = await tx.$queryRawUnsafe<{ pid: number }>('SELECT pg_backend_pid()::int AS pid');
      assert.equal(before[0].pid, after[0].pid);
      return before[0].pid;
    })));
    assert.ok(new Set(connectionIds).size > 1, 'MULTIPLE_POOL_CONNECTIONS_MUST_BE_EXERCISED');
    const outside = await db.$queryRawUnsafe<Array<{ marker: string }>>(`SELECT current_setting('agm.governance_context',true) AS marker`);
    assert.notEqual(outside[0].marker, 'approved', 'TRANSACTION_MARKER_MUST_NOT_LEAK');
    await Promise.all(Array.from({ length: 12 }, (_, index) => runtime.createProposal(proposal(`concurrent-${index}`))));
    assert.equal((await runtime.listProposals()).length, 12);

    stage = 'ATOMIC_MUTATION_AND_LEDGER_ROLLBACK';
    const eventsBefore = (await runtime.listGovernanceEvents()).length;
    // Inject an audit failure through a transaction-bound adapter, after the real
    // proposal INSERT. Prisma must roll back both state and its transaction marker.
    const failing = new GovernanceV2RuntimeService(new GovernanceV2Persistence({
      $queryRawUnsafe: db.$queryRawUnsafe.bind(db), $executeRawUnsafe: db.$executeRawUnsafe.bind(db),
      $transaction: (work: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => work({
        $queryRawUnsafe: tx.$queryRawUnsafe.bind(tx),
        $executeRawUnsafe: (sql: string, ...values: unknown[]) => {
          if (sql.startsWith('INSERT INTO agm_governance.governance_events')) throw new Error('INJECTED_LEDGER_FAILURE');
          return tx.$executeRawUnsafe(sql, ...values);
        },
      })),
    } as never));
    await denies(() => failing.createProposal(proposal('must-rollback')), 'INJECTED_LEDGER_FAILURE');
    assert.equal(await runtime.readProposal('must-rollback'), null);
    assert.equal((await runtime.listGovernanceEvents()).length, eventsBefore);
    await runtime.transaction(async () => {
      await runtime.createProposal(proposal('nested-one'));
      await runtime.createProposal(proposal('nested-two'));
    });
    await denies(() => runtime.transaction(async () => {
      await runtime.createProposal(proposal('nested-must-rollback'));
      try { await runtime.transaction(async () => { throw new Error('NESTED_FAILURE'); }); } catch { /* must still roll back */ }
    }), 'GOVERNANCE_TRANSACTION_ABORTED');
    assert.equal(await runtime.readProposal('nested-must-rollback'), null);

    stage = 'AUTHORIZATION_NEGATIVE_CONTROLS';
    await runtime.transitionProposal('concurrent-0', 'REVIEWED', 'regression-validator');
    await denies(() => runtime.transitionProposal('concurrent-0', 'ACCEPTED_FOR_CHANGE_CONTROL', 'regression-validator'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
    await denies(() => runtime.transitionProposal('concurrent-0', 'ACCEPTED_FOR_CHANGE_CONTROL', 'regression-proposer'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
    await runtime.transitionProposal('concurrent-0', 'ACCEPTED_FOR_CHANGE_CONTROL', 'regression-approver', ['test:decision']);
    await denies(() => runtime.recordProductionExecution('pcr', 'unknown-actor', 'rev'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
    await denies(() => runtime.validateProductionChange('pcr', 'regression-executor', ['proof'], 'PASS'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
    await denies(() => runtime.recordDependencyResult('pcr', 'A', 'PASS', 'regression-proposer'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
    await denies(() => runtime.recordDependencyGraphStatus('pcr', 'COMPLETE', 'proof', 'regression-approver'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');

    stage = 'FULL_DEPENDENCY_CLOSURE';
    for (const [source, target, supersededAt] of [['A', 'A1'], ['A1', 'A'], ['B', 'B1'], ['B1', 'C'], ['C', 'B'], ['B', 'old', now]]) {
      await runtime.addDependencyEdge({ id: `${source}-${target}`, sourceComponent: source!, targetComponent: target!, relation: 'DEPENDS_ON', criticality: 'HIGH', validationRequired: true, introducedAt: now, supersededAt }, 'regression-validator');
    }
    await runtime.createProductionChange({ id: 'pcr', semanticTitle: 'Disconnected dependency roots', description: 'disposable test', impactClass: 'CONTROLLED', affectedComponents: ['A', 'B', 'A'], affectedCanonicalSources: [], dependencyImpactRef: 'graph', impactStudy: 'study', testPlan: 'tests', rollbackPlan: 'rollback', snapshotRef: 'snapshot', candidateRef: 'regression-candidate', relatedIncidents: [], relatedCSC: [], proposerId: 'regression-proposer' });
    await runtime.assessProductionChange('pcr', 'regression-validator');
    await runtime.recordDependencyGraphStatus('pcr', 'COMPLETE', 'graph:evidence', 'regression-validator');
    for (const component of ['A', 'A1', 'B']) await runtime.recordDependencyResult('pcr', component, 'PASS', 'regression-validator');
    await denies(() => runtime.approveProductionChange('pcr', 'regression-approver'), 'REGRESSION_CASCADE_BLOCKED');
    await runtime.recordDependencyResult('pcr', 'B1', 'PASS', 'regression-validator');
    await runtime.recordDependencyResult('pcr', 'C', 'FAIL', 'regression-validator');
    await denies(() => runtime.approveProductionChange('pcr', 'regression-approver'), 'REGRESSION_CASCADE_BLOCKED');
    await runtime.recordDependencyResult('pcr', 'C', 'PASS', 'regression-validator');
    // The superseded edge must not be part of the live closure.
    assert.deepEqual(await runtime.impactedComponents('B'), ['B', 'B1', 'C']);
    await runtime.approveProductionChange('pcr', 'regression-approver');
    await denies(() => runtime.recordDependencyResult('pcr', 'C', 'FAIL', 'regression-validator'), 'PCR_INVALID_TRANSITION');
    await runtime.createVersion({ id: 'version', semanticTitle: 'Fixture', status: 'WIP', baseRevision: 'base', commitSha: 'revision', artifactDigests: ['sha256:test'], candidateSnapshot: 'snapshot', validationEvidence: [], pcrRefs: ['pcr'], cscRefs: [], incidentRefs: [] }, 'regression-proposer');
    await runtime.promoteVersion('version', 'CANDIDATE', 'regression-proposer');
    await runtime.promoteVersion('version', 'VALIDATED', 'regression-validator');
    await runtime.promoteVersion('version', 'CANONICAL', 'regression-approver');
    const gate = await runtime.evaluateProductionReleaseGate('pcr', 'regression-executor', { candidateRef: 'regression-candidate', versionId: 'version', revision: 'revision' });
    assert.deepEqual(gate.impactedComponents, ['A', 'A1', 'B', 'B1', 'C']);
    assert.equal(gate.productionMutation, false);
    await denies(() => runtime.recordProductionExecution('pcr', 'regression-executor', 'wrong-revision', { candidateRef: 'regression-candidate', versionId: 'version' }), 'RELEASE_BLOCKED:REVISION_MISMATCH');
    await runtime.recordProductionExecution('pcr', 'regression-executor', 'revision', { candidateRef: 'regression-candidate', versionId: 'version', artifactDigest: 'sha256:test' });
    await runtime.validateProductionChange('pcr', 'regression-validator', ['isolated:evidence'], 'PASS');

    stage = 'UNCHANGED_RK_AND_APPEND_ONLY_INTEGRITY';
    const assessment = await runtime.assessStructuralChange({ assessmentId: 'risk-test', proposalId: 'concurrent-1', scope: 'disposable', query: 'disposable', affectedComponents: ['B'], canonicalFacts: [] });
    assert.equal((await runtime.readRiskKnowledgeAssessment(assessment.assessmentId) as { assessment_id: string }).assessment_id, 'risk-test');
    const events = await runtime.listGovernanceEvents() as Array<{ event_id: string; event_digest: string; previous_event_id: string | null; previous_digest: string | null; recorded_at: Date }>;
    for (let index = 1; index < events.length; index++) {
      assert.equal(events[index].previous_event_id, events[index - 1].event_id);
      assert.equal(events[index].previous_digest, events[index - 1].event_digest);
    }
    await assert.rejects(() => db.$executeRawUnsafe('UPDATE agm_governance.governance_events SET semantic_title=semantic_title'), /APPEND_ONLY/);
    await assert.rejects(() => db.$executeRawUnsafe('DELETE FROM agm_governance.governance_events'), /APPEND_ONLY/);
    await assert.rejects(() => db.$executeRawUnsafe(`UPDATE agm_governance.proposals SET status='REJECTED' WHERE proposal_id='concurrent-0'`), /GOVERNANCE_STRUCTURAL_WRITE_BOUNDARY/);
    console.log(JSON.stringify({ status: 'PASS', environment: 'DISPOSABLE_ONLY', connectionLimit: 4, distinctConnections: new Set(connectionIds).size, concurrentProposals: 12, rollbackAfterAuditFailure: 'PASS', nestedTransactionLedger: 'PASS', fullDependencyClosure: gate.impactedComponents, roleNegativeControls: 'PASS', unchangedRiskKnowledgeWrite: 'PASS', appendOnlyLedger: 'PASS', productionMutation: false }));
  } catch (error) {
    const transport = error as { code?: string; status?: number; signal?: string; stderr?: Buffer; stdout?: Buffer };
    const safeTransportDetail = ['CREATE_DISPOSABLE_DATABASE', 'MIGRATE_DISPOSABLE_DATABASE'].includes(stage)
      ? [transport.stderr, transport.stdout].filter(Boolean).map(value => value!.toString()).join('\n').replaceAll(password, '[REDACTED]').replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DISPOSABLE_DATABASE_URL]').slice(-2000) : undefined;
    console.error(JSON.stringify({ status: 'FAIL', stage, error: error instanceof Error ? error.name : 'UnknownError', code: transport.code, exitStatus: transport.status, signal: transport.signal, transportDetail: safeTransportDetail, detail: error instanceof assert.AssertionError ? error.message : undefined }));
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
    if (started) {
      try { execFileSync('docker', ['stop', container], { stdio: 'pipe', timeout: 60000 }); }
      catch { console.error(JSON.stringify({ cleanup: 'VERIFY_OWN_DISPOSABLE_CONTAINER', container })); }
    }
  }
}
void main();
