import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createAgmatccRehearsalApp } from './start-agmatcc-isolated-local';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await createAgmatccRehearsalApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const prisma = app.get(PrismaService);
    const before = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "LunaEvaluationReservation"`;
    const cases = [
      { route: '/api/v1/agmatcc-copilot/respond', method: 'POST', body: { question: 'Ce evenimente sunt disponibile?', language: 'ro' } },
      { route: '/api/v1/acpm', method: 'GET' },
      { route: '/api/v1/turn-admin/validate', method: 'POST' },
    ];
    const results = [];
    for (const c of cases) {
      const result = await fetch(`${base}${c.route}`, { method: c.method, headers: { 'Content-Type': 'application/json' }, ...(c.body ? { body: JSON.stringify(c.body) } : {}) });
      assert.equal(result.status, 401, c.route);
      results.push({ route: c.route, status: result.status });
    }
    const after = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "LunaEvaluationReservation"`;
    assert.equal(String(after[0].count), String(before[0].count));
    const users = await prisma.user.count(); const credentials = await prisma.turnAdminCredential.count();
    console.log(JSON.stringify({ verdict: 'PASS_AUTH_BOUNDARY', results, paidRequests: 0, users, turnCredentials: credentials,
      combinedLiveE2E: users === 0 && credentials === 0 ? 'BLOCKED_NO_EXISTING_AUTHORIZED_IDENTITY' : 'NOT_EXECUTED', credentialsCreated: false }));
  } finally { await app.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'AUTH_BOUNDARY_FAILED'); process.exitCode = 1; });
