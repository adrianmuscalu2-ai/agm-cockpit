import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { GovernanceV2Persistence } from '../src/governance-v2/governance-v2.persistence';
import { GovernanceV2RuntimeService } from '../src/governance-v2/governance-v2.runtime';

// Real-PostgreSQL certification of the Approver decision path and the absence of authority escalation.
// Requires a disposable, migrated, non-Production database in DATABASE_URL (with connection_limit=1).
const url = process.env.DATABASE_URL ?? '';
if (!url || /agmcockpit\.com/i.test(url)) throw new Error('A disposable non-Production DATABASE_URL is required');
const prisma = new PrismaClient({ datasources: { db: { url } } });
const runtime = new GovernanceV2RuntimeService(new GovernanceV2Persistence(prisma as never));
const rejects = async (work: () => Promise<unknown>, code: string) => assert.rejects(work, (error: Error) => error.message.includes(code));
const now = new Date().toISOString();
const proposal = (proposalId: string, proposerId = 'atlas-operations') => ({
  proposalId, semanticTitle: `Proposal ${proposalId}`, description: 'decision path certification', scope: 'governance', proposalType: 'TEST',
  proposerId, createdAt: now, updatedAt: now, candidateRef: 'candidate-test', candidateDigest: 'digest-test', baseRevision: 'rev-test',
  affectedComponents: [], affectedFacts: [], correlationId: `corr-${proposalId}`, status: 'DRAFT' as const, evidenceRefs: [], riskAssessmentRefs: [],
  impactStudyRef: 'impact', dependencyGraphRef: 'deps', snapshotRef: 'snap', pcrRefs: [], cscRefs: [],
});

async function main() {
  await runtime.registerGovernanceActor({ id: 'atlas-operations', displayName: 'ATLAS', roles: ['PROPOSER'], canPropose: true, canValidate: false, canExecute: false, status: 'ACTIVE' });
  await runtime.registerGovernanceActor({ id: 'turn-commander-adrian', displayName: 'Turn Commander', roles: ['APPROVER'], canPropose: false, canValidate: false, canExecute: false, status: 'ACTIVE' });
  await runtime.registerGovernanceActor({ id: 'independent-validator-test', displayName: 'Validator', roles: ['VALIDATOR'], canPropose: false, canValidate: true, canExecute: false, status: 'ACTIVE' });

  // The Approver cannot propose, and ATLAS cannot validate or approve.
  await rejects(() => runtime.createProposal(proposal('p-approver', 'turn-commander-adrian')), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
  await runtime.createProposal(proposal('p-1'));
  await rejects(() => runtime.transitionProposal('p-1', 'REVIEWED', 'atlas-operations'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
  await rejects(() => runtime.decideProposal('p-1', 'ACCEPTED_FOR_CHANGE_CONTROL', 'atlas-operations'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
  // No approval before an independent validator reviewed it.
  await rejects(() => runtime.decideProposal('p-1', 'ACCEPTED_FOR_CHANGE_CONTROL', 'turn-commander-adrian'), 'PROPOSAL_INVALID_TRANSITION');
  // A validator cannot decide (not an Approver).
  await runtime.transitionProposal('p-1', 'REVIEWED', 'independent-validator-test');
  await rejects(() => runtime.decideProposal('p-1', 'ACCEPTED_FOR_CHANGE_CONTROL', 'independent-validator-test'), 'GOVERNANCE_ACTOR_UNAUTHORIZED');
  await rejects(() => runtime.decideProposal('missing', 'REJECTED', 'turn-commander-adrian'), 'PROPOSAL_NOT_FOUND');

  const accepted = await runtime.decideProposal('p-1', 'ACCEPTED_FOR_CHANGE_CONTROL', 'turn-commander-adrian', ['decision:turn-commander']) as Record<string, unknown>;
  assert.equal(accepted.status, 'ACCEPTED_FOR_CHANGE_CONTROL');
  await rejects(() => runtime.decideProposal('p-1', 'REJECTED', 'turn-commander-adrian'), 'PROPOSAL_INVALID_TRANSITION');

  // Rejection path and append-only audit trail.
  await runtime.createProposal(proposal('p-2'));
  const rejected = await runtime.decideProposal('p-2', 'REJECTED', 'turn-commander-adrian') as Record<string, unknown>;
  assert.equal(rejected.status, 'REJECTED');
  const events = await runtime.listGovernanceEvents('p-1') as Array<{ event_type: string; actor_id: string }>;
  assert.ok(events.some((e) => e.event_type === 'PROPOSAL_DECIDED' && e.actor_id === 'turn-commander-adrian'));
  assert.ok(events.some((e) => e.event_type === 'PROPOSAL_REVIEWED' && e.actor_id === 'independent-validator-test'));

  console.log(JSON.stringify({ verdict: 'PASS' }));
}

main().finally(() => prisma.$disconnect());
