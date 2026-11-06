import { PrismaClient } from '@prisma/client';
import { GovernanceV2Persistence } from '../src/governance-v2/governance-v2.persistence';
import { GovernanceV2RuntimeService } from '../src/governance-v2/governance-v2.runtime';

// Activation of the Turn Commander decision of 2026-11-06 (ATLAS = Proposer, turn-commander-adrian = Approver).
// Idempotent and append-only. Principal ids/company come from the environment; nothing is invented.
// Production execution requires the operator's own authorized DATABASE_URL (use connection_limit=1).
const need = (name: string) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; };
const url = need('DATABASE_URL');
const company = need('GOVERNANCE_COMPANY_ID');
const atlasMachineId = need('GOVERNANCE_ATLAS_MACHINE_IDENTITY_ID');
const commanderUserId = need('GOVERNANCE_COMMANDER_USER_ID');
const DECISION = 'turn-commander-decision-20261106-governance-v2-actors';
const prisma = new PrismaClient({ datasources: { db: { url } } });
const runtime = new GovernanceV2RuntimeService(new GovernanceV2Persistence(prisma as never));

async function main() {
  await runtime.registerGovernanceActor({ id: 'atlas-operations', displayName: 'ATLAS · Coordonare Operațională', roles: ['PROPOSER'], canPropose: true, canValidate: false, canExecute: false, status: 'ACTIVE' });
  await runtime.registerGovernanceActor({ id: 'turn-commander-adrian', displayName: 'Turn Commander', roles: ['APPROVER'], canPropose: false, canValidate: false, canExecute: false, status: 'ACTIVE' });
  await runtime.bindActorIdentity({ actorId: 'atlas-operations', principalType: 'MACHINE_IDENTITY', principalId: atlasMachineId, companyId: company, status: 'BOUND', decisionRef: DECISION, recordedBy: 'turn-commander-adrian' });
  await runtime.bindActorIdentity({ actorId: 'turn-commander-adrian', principalType: 'HUMAN_USER', principalId: commanderUserId, companyId: company, status: 'BOUND', decisionRef: DECISION, recordedBy: 'turn-commander-adrian' });
  console.log(JSON.stringify({ activated: ['atlas-operations', 'turn-commander-adrian'], decisionRef: DECISION }));
}

main().finally(() => prisma.$disconnect());
