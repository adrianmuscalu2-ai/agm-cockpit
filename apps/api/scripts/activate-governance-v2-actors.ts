import { PrismaClient } from '@prisma/client';
import type { GovernanceActorPrincipal } from '../src/governance-v2/governance-v2.contract';
import { GovernanceV2Persistence } from '../src/governance-v2/governance-v2.persistence';
import { GovernanceV2RuntimeService } from '../src/governance-v2/governance-v2.runtime';

// Apply only the approved actor bindings. This does not activate Governance V2.
// Principal ids/company come from the environment and are verified against the canonical tables.
// Repeated runs skip matching records and fail closed on conflicts; no history is rewritten.
const need = (name: string) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; };
const url = need('DATABASE_URL');
const company = need('GOVERNANCE_COMPANY_ID');
const atlasMachineId = need('GOVERNANCE_ATLAS_MACHINE_IDENTITY_ID');
const commanderUserId = need('GOVERNANCE_COMMANDER_USER_ID');
const DECISION = 'turn-commander-decision-20261106-governance-v2-actors';
const prisma = new PrismaClient({ datasources: { db: { url } } });
const runtime = new GovernanceV2RuntimeService(new GovernanceV2Persistence(prisma as never));

const actors: GovernanceActorPrincipal[] = [
  { id: 'atlas-operations', displayName: 'ATLAS · Coordonare Operațională', roles: ['PROPOSER'], canPropose: true, canValidate: false, canExecute: false, status: 'ACTIVE' as const },
  { id: 'turn-commander-adrian', displayName: 'Turn Commander', roles: ['APPROVER'], canPropose: false, canValidate: false, canExecute: false, status: 'ACTIVE' as const },
];

async function ensureActor(actor: typeof actors[number]) {
  const existing = await runtime.readGovernanceActor(actor.id) as {
    display_name: string; roles: unknown; can_propose: boolean; can_validate: boolean; can_execute: boolean; status: string;
  } | null;
  if (!existing) {
    await runtime.registerGovernanceActor(actor);
    return 'CREATED';
  }
  const rolesMatch = Array.isArray(existing.roles)
    && JSON.stringify(existing.roles) === JSON.stringify(actor.roles);
  if (existing.display_name !== actor.displayName || !rolesMatch || existing.can_propose !== actor.canPropose
    || existing.can_validate !== actor.canValidate || existing.can_execute !== actor.canExecute || existing.status !== actor.status) {
    throw new Error(`GOVERNANCE_ACTOR_CONFLICT:${actor.id}`);
  }
  return 'EXISTING';
}

async function ensureBinding(input: {
  actorId: string; principalType: 'MACHINE_IDENTITY' | 'HUMAN_USER'; principalId: string; companyId: string;
}) {
  const existing = await runtime.readActorIdentityBinding(input.principalType, input.principalId) as {
    actor_id: string; company_id: string; status: string; decision_ref: string;
  } | null;
  if (!existing) {
    await runtime.bindActorIdentity({ ...input, status: 'BOUND', decisionRef: DECISION, recordedBy: 'turn-commander-adrian' });
    return 'CREATED';
  }
  if (existing.actor_id === input.actorId && existing.company_id === input.companyId
    && existing.status === 'BOUND' && existing.decision_ref === DECISION) return 'EXISTING';
  throw new Error(`GOVERNANCE_IDENTITY_BINDING_CONFLICT:${input.principalType}`);
}

async function main() {
  const machine = await prisma.machineIdentity.findFirst({
    where: { id: atlasMachineId, companyId: company },
    select: { subject: true, status: true, scopes: true },
  });
  if (!machine || machine.subject !== 'atlas-operations' || machine.status !== 'ACTIVE'
    || !Array.isArray(machine.scopes) || !machine.scopes.includes('governance:propose')) {
    throw new Error('GOVERNANCE_ATLAS_MACHINE_IDENTITY_INVALID');
  }
  const commander = await prisma.user.findFirst({
    where: { id: commanderUserId, companyId: company },
    select: { id: true, status: true },
  });
  if (!commander || commander.status !== 'Active') throw new Error('GOVERNANCE_COMMANDER_USER_INVALID');

  const actorResults = [];
  for (const actor of actors) actorResults.push({ actorId: actor.id, result: await ensureActor(actor) });
  const atlasBinding = await ensureBinding({ actorId: 'atlas-operations', principalType: 'MACHINE_IDENTITY', principalId: atlasMachineId, companyId: company });
  const commanderBinding = await ensureBinding({ actorId: 'turn-commander-adrian', principalType: 'HUMAN_USER', principalId: commanderUserId, companyId: company });
  console.log(JSON.stringify({
    actors: actorResults,
    bindings: { atlas: atlasBinding, turnCommander: commanderBinding },
    governanceStatus: 'NOT_ACTIVATED',
    decisionRef: DECISION,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
