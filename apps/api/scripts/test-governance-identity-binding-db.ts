import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { GovernanceV2Persistence } from '../src/governance-v2/governance-v2.persistence';
import { GovernanceV2RuntimeService } from '../src/governance-v2/governance-v2.runtime';

// Real-PostgreSQL certification of the Governance V2 actor <-> authenticated identity binding.
// Requires a disposable, migrated, non-Production database in DATABASE_URL (with connection_limit=1).
const url = process.env.DATABASE_URL ?? '';
if (!url || /agmcockpit\.com/i.test(url)) throw new Error('A disposable non-Production DATABASE_URL is required');
const prisma = new PrismaClient({ datasources: { db: { url } } });
const runtime = new GovernanceV2RuntimeService(new GovernanceV2Persistence(prisma as never));
const COMPANY = 'company-test';
const DECISION = 'turn-commander-decision-20261106';
const rejects = async (work: () => Promise<unknown>, code: string) => assert.rejects(work, (error: Error) => error.message.includes(code));

async function main() {
  await runtime.registerGovernanceActor({ id: 'atlas-operations', displayName: 'ATLAS', roles: ['PROPOSER'], canPropose: true, canValidate: false, canExecute: false, status: 'ACTIVE' });
  await runtime.registerGovernanceActor({ id: 'turn-commander-adrian', displayName: 'Turn Commander', roles: ['APPROVER'], canPropose: false, canValidate: false, canExecute: false, status: 'ACTIVE' });
  await runtime.registerGovernanceActor({ id: 'independent-validator-test', displayName: 'Validator', roles: ['VALIDATOR'], canPropose: false, canValidate: true, canExecute: false, status: 'ACTIVE' });

  const atlas = { type: 'MACHINE_IDENTITY' as const, id: 'machine-atlas', companyId: COMPANY, scopes: ['governance:propose'] };
  await rejects(() => runtime.resolveAuthenticatedActor(atlas, 'propose'), 'GOVERNANCE_IDENTITY_NOT_BOUND');
  await runtime.bindActorIdentity({ actorId: 'atlas-operations', principalType: 'MACHINE_IDENTITY', principalId: 'machine-atlas', companyId: COMPANY, status: 'BOUND', decisionRef: DECISION, recordedBy: 'turn-commander-adrian' });
  await runtime.bindActorIdentity({ actorId: 'turn-commander-adrian', principalType: 'HUMAN_USER', principalId: 'user-adrian', companyId: COMPANY, status: 'BOUND', decisionRef: DECISION, recordedBy: 'turn-commander-adrian' });

  assert.equal(await runtime.resolveAuthenticatedActor(atlas, 'propose'), 'atlas-operations');
  await rejects(() => runtime.resolveAuthenticatedActor({ ...atlas, scopes: ['acp:read'] }, 'propose'), 'GOVERNANCE_SCOPE_MISSING');
  await rejects(() => runtime.resolveAuthenticatedActor({ ...atlas, companyId: 'other-company' }, 'propose'), 'GOVERNANCE_IDENTITY_NOT_BOUND');
  const human = { type: 'HUMAN_USER' as const, id: 'user-adrian', companyId: COMPANY };
  assert.equal(await runtime.resolveAuthenticatedActor(human), 'turn-commander-adrian');
  await rejects(() => runtime.resolveAuthenticatedActor(human, 'propose'), 'GOVERNANCE_SCOPE_MISSING');
  await rejects(() => runtime.bindActorIdentity({ actorId: 'nobody', principalType: 'HUMAN_USER', principalId: 'u', companyId: COMPANY, status: 'BOUND', decisionRef: DECISION, recordedBy: 'x' }), 'GOVERNANCE_ACTOR_UNKNOWN');

  await runtime.bindActorIdentity({ actorId: 'atlas-operations', principalType: 'MACHINE_IDENTITY', principalId: 'machine-atlas', companyId: COMPANY, status: 'REVOKED', decisionRef: `${DECISION}:revoke`, recordedBy: 'turn-commander-adrian' });
  await rejects(() => runtime.resolveAuthenticatedActor(atlas, 'propose'), 'GOVERNANCE_IDENTITY_NOT_BOUND');

  await assert.rejects(() => prisma.$executeRawUnsafe(`UPDATE agm_governance.actor_identity_bindings SET status='BOUND'`), /APPEND_ONLY/);
  await assert.rejects(() => prisma.$executeRawUnsafe(`DELETE FROM agm_governance.actor_identity_bindings`), /APPEND_ONLY/);
  console.log(JSON.stringify({ verdict: 'PASS', checks: 11 }));
}

main().finally(() => prisma.$disconnect());
