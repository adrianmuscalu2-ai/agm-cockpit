import { PrismaClient } from '@prisma/client';

// READ-ONLY Governance V2 actor readiness report. Issues SELECT statements only: it registers nothing,
// changes no authority and invents no identity. Intended to run against loopback/non-Production databases
// or any database for which the operator holds read-only credentials (AGM_GOVERNANCE_READONLY_DATABASE_URL).
const url = process.env.AGM_GOVERNANCE_READONLY_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
if (!url) throw new Error('AGM_GOVERNANCE_READONLY_DATABASE_URL or DATABASE_URL is required');

const FINAL_APPROVER = 'turn-commander-adrian';
const prisma = new PrismaClient({ datasources: { db: { url } } });

type Row = { actor_id: string; display_name: string; roles: unknown; can_propose: boolean; can_validate: boolean; can_execute: boolean; status: string };

async function main() {
  const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT actor_id, display_name, roles, can_propose, can_validate, can_execute, status FROM agm_governance.actor_principals ORDER BY actor_id');
  const active = rows.filter((row) => row.status === 'ACTIVE');
  const withRole = (role: string) => active.filter((row) => Array.isArray(row.roles) && (row.roles as string[]).includes(role)).map((row) => row.actor_id);
  const report = {
    mode: 'READ_ONLY',
    actors: rows.map((row) => ({ actorId: row.actor_id, status: row.status, roles: row.roles, canPropose: row.can_propose, canValidate: row.can_validate, canExecute: row.can_execute })),
    roleCoverage: { PROPOSER: withRole('PROPOSER'), APPROVER: withRole('APPROVER'), EXECUTOR: withRole('EXECUTOR'), VALIDATOR: withRole('VALIDATOR') },
    finalApproverRegistered: active.some((row) => row.actor_id === FINAL_APPROVER),
    // actor_principals carries no link to an authenticated principal (TURN user id or machine-auth subject).
    authenticatedBindingPresent: false,
    gaps: [] as string[],
  };
  for (const role of ['PROPOSER', 'APPROVER']) if (!report.roleCoverage[role as 'PROPOSER' | 'APPROVER'].length) report.gaps.push(`NO_ACTIVE_${role}_REGISTERED`);
  if (!report.finalApproverRegistered) report.gaps.push('FINAL_APPROVER_NOT_REGISTERED');
  report.gaps.push('ACTOR_ID_NOT_BOUND_TO_AUTHENTICATED_PRINCIPAL');
  console.log(JSON.stringify(report, null, 2));
}

main().finally(() => prisma.$disconnect());
