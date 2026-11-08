import { PrismaClient } from '@prisma/client';
import type { GovernanceActorPrincipal } from '../src/governance-v2/governance-v2.contract';
import { GovernanceV2Persistence } from '../src/governance-v2/governance-v2.persistence';
import { GovernanceV2RuntimeService } from '../src/governance-v2/governance-v2.runtime';
import { verifyCommanderRecoveryAuthority } from '../src/governance-v2/commander-binding-authority';

// Apply only the approved actor bindings. This does not activate Governance V2.
// Principal ids/company come from the environment and are verified against the canonical tables.
// Repeated runs skip matching records and fail closed on conflicts; no history is rewritten.
const need = (name: string) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; };
const url = need('DATABASE_URL');
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
  const migration = await prisma.$queryRaw<Array<{ ready: boolean }>>`
    SELECT to_regclass('agm_governance.actor_identity_bindings') IS NOT NULL AS ready
  `;
  if (!migration[0]?.ready) throw new Error('GOVERNANCE_ACTOR_BINDING_MIGRATION_MISSING');

  const proposerCandidates = (await prisma.machineIdentity.findMany({
    where: { subject: 'atlas-operations', status: 'ACTIVE' },
    select: { id: true, companyId: true, scopes: true },
  })).filter((identity) => Array.isArray(identity.scopes) && identity.scopes.includes('governance:propose'));
  if (proposerCandidates.length !== 1) {
    throw new Error(`GOVERNANCE_ATLAS_IDENTITY_NOT_UNIQUE:${proposerCandidates.length}`);
  }
  const machine = proposerCandidates[0];
  const machineScopes = Array.isArray(machine.scopes)
    ? machine.scopes.filter((scope): scope is string => typeof scope === 'string')
    : [];
  if (!machineScopes.includes('acp:read') || !machineScopes.includes('governance:propose')) {
    throw new Error('GOVERNANCE_ATLAS_MACHINE_IDENTITY_INVALID');
  }
  const company = await prisma.company.findUnique({
    where: { id: machine.companyId },
    select: { id: true, isActive: true },
  });
  if (!company?.isActive) throw new Error('GOVERNANCE_COMPANY_INACTIVE');

  const ownerRoles = await prisma.role.findMany({
    where: { companyId: company.id, code: 'company_owner', isActive: true },
    select: { id: true },
  });
  if (ownerRoles.length !== 1) throw new Error(`GOVERNANCE_COMMANDER_ROLE_NOT_UNIQUE:${ownerRoles.length}`);
  const commanderAssignments = await prisma.userRole.findMany({
    where: { companyId: company.id, roleId: ownerRoles[0].id, user: { status: 'Active' } },
    select: { userId: true },
  });
  const commanderUserIds = [...new Set(commanderAssignments.map(({ userId }) => userId))];
  const priorCommanderIds: string[] = [];
  for (const id of commanderUserIds) {
    const binding = await runtime.readActorIdentityBinding('HUMAN_USER', id);
    if (binding && bindingMatches(binding, { actorId: 'turn-commander-adrian', companyId: company.id })) priorCommanderIds.push(id);
  }
  if (priorCommanderIds.length > 1) throw new Error('GOVERNANCE_COMMANDER_EXISTING_BINDING_NOT_UNIQUE');
  const recoveryReference = process.env.AGM_COMMANDER_RECOVERY_REQUEST_ID?.trim();
  let commanderUserId: string;
  if (recoveryReference) {
    commanderUserId = await verifyCommanderRecoveryAuthority(prisma, company.id, commanderUserIds, recoveryReference);
    if (priorCommanderIds.length === 1 && priorCommanderIds[0] !== commanderUserId) {
      throw new Error('GOVERNANCE_COMMANDER_EXISTING_BINDING_CONFLICT');
    }
  } else if (priorCommanderIds.length === 1) {
    commanderUserId = priorCommanderIds[0];
  } else {
    if (commanderUserIds.length !== 1) throw new Error(`GOVERNANCE_COMMANDER_IDENTITY_NOT_UNIQUE:${commanderUserIds.length}`);
    commanderUserId = commanderUserIds[0];
  }

  const existingActors = await Promise.all(actors.map((actor) => runtime.readGovernanceActor(actor.id)));
  const existingBindings = await Promise.all([
    runtime.readActorIdentityBinding('MACHINE_IDENTITY', machine.id),
    runtime.readActorIdentityBinding('HUMAN_USER', commanderUserId),
  ]);
  if (existingActors.some((actor, index) => actor && !actorMatches(actor, actors[index]))) {
    throw new Error('GOVERNANCE_ACTOR_CONFLICT');
  }
  const expectedBindings = [
    { actorId: 'atlas-operations', companyId: company.id },
    { actorId: 'turn-commander-adrian', companyId: company.id },
  ];
  if (existingBindings.some((binding, index) => binding && !bindingMatches(binding, expectedBindings[index]))) {
    throw new Error('GOVERNANCE_IDENTITY_BINDING_CONFLICT');
  }

  const actorResults = [];
  for (const actor of actors) actorResults.push({ actorId: actor.id, result: await ensureActor(actor) });
  const atlasBinding = await ensureBinding({ actorId: 'atlas-operations', principalType: 'MACHINE_IDENTITY', principalId: machine.id, companyId: company.id });
  const commanderBinding = await ensureBinding({ actorId: 'turn-commander-adrian', principalType: 'HUMAN_USER', principalId: commanderUserId, companyId: company.id });
  const resolvedAtlas = await runtime.resolveAuthenticatedActor({
    type: 'MACHINE_IDENTITY', id: machine.id, companyId: company.id, scopes: machineScopes,
  }, 'propose');
  const resolvedCommander = await runtime.resolveAuthenticatedActor({
    type: 'HUMAN_USER', id: commanderUserId, companyId: company.id,
  });
  if (resolvedAtlas !== 'atlas-operations' || resolvedCommander !== 'turn-commander-adrian') {
    throw new Error('GOVERNANCE_ACTOR_BINDING_VERIFICATION_FAILED');
  }
  console.log(JSON.stringify({
    companyId: company.id,
    principals: { atlasMachineIdentityId: machine.id, turnCommanderUserId: commanderUserId },
    actors: actorResults,
    bindings: { atlas: atlasBinding, turnCommander: commanderBinding },
    governanceStatus: 'NOT_ACTIVATED',
    authenticatedActorResolution: 'PASS',
    decisionRef: DECISION,
  }));
}

function actorMatches(existing: unknown, actor: GovernanceActorPrincipal) {
  const value = existing as {
    display_name: string; roles: unknown; can_propose: boolean; can_validate: boolean; can_execute: boolean; status: string;
  };
  return value.display_name === actor.displayName
    && Array.isArray(value.roles)
    && JSON.stringify(value.roles) === JSON.stringify(actor.roles)
    && value.can_propose === actor.canPropose
    && value.can_validate === actor.canValidate
    && value.can_execute === actor.canExecute
    && value.status === actor.status;
}

function bindingMatches(existing: unknown, expected: { actorId: string; companyId: string }) {
  const value = existing as { actor_id: string; company_id: string; status: string; decision_ref: string };
  return value.actor_id === expected.actorId
    && value.company_id === expected.companyId
    && value.status === 'BOUND'
    && value.decision_ref === DECISION;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
