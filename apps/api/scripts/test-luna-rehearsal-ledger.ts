import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { LunaAcpmLedger } from '../src/agmatcc-copilot/luna-acpm-ledger';
import { canonicalAcpm } from '../src/acpm/acpm.canonical';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55432'); assert.equal(url.pathname, '/agm_cockpit_191_rehearsal');
  const prisma = new PrismaClient();
  const second = new PrismaClient();
  try {
    // Recover only this test's explicitly labelled no-provider reservations from interrupted runs.
    // Never reclaim a live/unknown reservation or erase a row.
    const pending = await prisma.$queryRaw<Array<{ callId: string; executionId: string; companyId: string; startedAt: Date }>>`SELECT r."callId",r."executionId",r."companyId",r."startedAt" FROM "LunaEvaluationReservation" r JOIN "Company" c ON c.id=r."companyId" WHERE r.state='RESERVED' AND c."companyName"='ACPM budget validation fixture - no model calls' AND EXISTS (SELECT 1 FROM "AgentChainPerformanceEvent" e WHERE e."companyId"=r."companyId" AND e.payload->>'runId'=r."callId"::text AND e.payload->>'mandateId'='isolated-eval:BUDGET_TEST_NO_PROVIDER_CALL')`;
    const recovery = new LunaAcpmLedger(prisma as never);
    for (const r of pending) await recovery.settle({ ...r, startedAt: r.startedAt.toISOString(), mandateId: 'isolated-eval:BUDGET_TEST_NO_PROVIDER_CALL' }, { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }, 'TEST_NO_PROVIDER_CALL_RECOVERED', []);
    // No account, credentials, roles or authority are provisioned. Keep the labelled test data.
    const company = await prisma.company.create({ data: { companyName: 'ACPM budget validation fixture - no model calls', countryCode: 'RO', defaultCurrencyCode: 'EUR' } });
    const ctx = { companyId: company.id, userId: 'validation:no-authentication-claim', roles: [], requestId: randomUUID(), correlationId: randomUUID() };
    const ledgers = [new LunaAcpmLedger(prisma as never), new LunaAcpmLedger(second as never)];
    const results = await Promise.allSettled(Array.from({ length: 55 }, (_, i) => ledgers[i % 2].reserve(ctx, randomUUID(), 'isolated-eval:BUDGET_TEST_NO_PROVIDER_CALL')));
    const accepted = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    if (!accepted.length) throw new Error(`RESERVATION_FAILURE: ${String(rejected[0]?.reason)}`);
    assert(accepted.length <= 49);
    assert(rejected.length > 0);
    for (const r of rejected) assert.match(String(r.reason), /ACPM_BUDGET_EXHAUSTED/);
    const [peak] = await prisma.$queryRaw<Array<{ used: bigint }>>`SELECT "priorNanoUsd" + (SELECT SUM(COALESCE("chargedNanoUsd","reservedNanoUsd"))::bigint FROM "LunaEvaluationReservation") AS used FROM "LunaEvaluationBudget"`;
    assert(BigInt(peak.used) <= 5_000_000_000n);
    // Zero is known: this validation never invokes a provider. Label every terminal event accordingly.
    for (const r of accepted) await ledgers[0].settle(r, { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }, 'TEST_NO_PROVIDER_CALL', []);
    await assert.rejects(ledgers[1].settle(accepted[0], { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }, 'TEST_NO_PROVIDER_CALL', []), /ALREADY_SETTLED/);
    const events = await prisma.$queryRaw<Array<{ payload: any; payloadHash: string }>>`SELECT "payload","payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${company.id}::uuid`;
    assert.equal(events.length, accepted.length * 2);
    for (const event of events) assert.equal(createHash('sha256').update(canonicalAcpm(event.payload)).digest('hex'), event.payloadHash);
    const reread = await second.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "AgentChainPerformanceEvent" WHERE "companyId"=${company.id}::uuid`;
    assert.equal(Number(reread[0].count), events.length);
    console.log(JSON.stringify({ verdict: 'PASS', scope: 'Real PostgreSQL budget/persistence; NOT authentication or live model E2E', independentClients: 2, concurrentRequests: 55, accepted: accepted.length, refused: rejected.length, peakAccountedNanoUsd: String(peak.used), persistedEvents: events.length, hashesValid: true, duplicateSettlementRejected: true, fixtureCompanyId: company.id, providerCalls: 0 }));
  } finally { await prisma.$disconnect(); await second.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'LEDGER_TEST_FAILED'); process.exitCode = 1; });
