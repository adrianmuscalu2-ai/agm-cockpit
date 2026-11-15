import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createAgmatccRehearsalApp } from './start-agmatcc-isolated-local';
import { PrismaService } from '../src/prisma/prisma.service';

/** Supply existing rehearsal credentials through process environment only.
 * This runner never provisions a user, PIN, role, session row or fabricated JWT.
 */
async function main() {
  const pin = process.env.AGM_REHEARSAL_TURN_PIN;
  const email = process.env.AGM_REHEARSAL_OWNER_EMAIL;
  const password = process.env.AGM_REHEARSAL_OWNER_PASSWORD;
  if (!pin || !email || !password) throw new Error('AUTHORIZED_REHEARSAL_TURN_AND_OWNER_CREDENTIALS_REQUIRED');
  assert.equal(process.env.AGMATCC_COPILOT_PROVIDER, 'openai');
  const app = await createAgmatccRehearsalApp();
  try {
    const prisma = app.get(PrismaService);
    assert(await prisma.turnAdminCredential.findUnique({ where: { id: 'turn-command-center' }, select: { id: true } }), 'EXISTING_TURN_CREDENTIAL_REQUIRED');
    assert.equal(await prisma.user.count({ where: { email } }), 1, 'ONE_EXISTING_OWNER_REQUIRED');
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const post = async (path: string, body: unknown, token?: string) => {
      const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      assert.equal(response.status, 201, `${path} rejected: HTTP ${response.status}`);
      return (await response.json() as { data: any }).data;
    };
    const turn = await post('/turn-admin/unlock', { pin });
    const owner = await post('/auth/login', { email, password });
    // Prove the existing OWNER read before spending anything.
    const before = await fetch(`${base}/acpm`, { headers: { Authorization: `Bearer ${owner.accessToken}` } });
    assert.equal(before.status, 200, 'OWNER_READ_REQUIRED');
    const result = await post('/agmatcc-copilot/respond', { question: 'Ce evenimente operaționale sunt disponibile în jurnal? Dacă lipsesc, spune UNKNOWN.', language: 'ro', testMandateId: 'authenticated-rehearsal' }, turn.accessToken);
    assert.equal(result.provider, 'openai'); assert.equal(result.model, 'gpt-6-luna');
    assert(['PASS', 'UNKNOWN'].includes(result.status));
    assert(result.usage.inputTokens > 0 && result.usage.outputTokens > 0);
    const after = await fetch(`${base}/acpm`, { headers: { Authorization: `Bearer ${owner.accessToken}` } });
    assert.equal(after.status, 200);
    const snapshot = (await after.json() as { data: { runs: Array<{ chainId: string }> } }).data;
    assert(snapshot.runs.some(run => run.chainId === result.executionId), 'OWNER_MUST_OBSERVE_SAME_TENANT_EXECUTION');
    const rows = await prisma.$queryRaw<Array<{ charged: bigint; count: bigint }>>`SELECT SUM("chargedNanoUsd")::bigint AS charged,count(*) FROM "LunaEvaluationReservation" WHERE "executionId"=${result.executionId}::uuid AND state='SETTLED'`;
    assert(Number(rows[0].count) > 0);
    assert(Math.abs(Number(rows[0].charged)/1e9-result.usage.estimatedCostUsd) < 0.00000002);
    console.log(JSON.stringify({ verdict: 'PASS', scope: 'Authenticated HTTP TURN -> real Luna -> persisted ACPM -> authorized OWNER read', executionId: result.executionId, status: result.status, usage: result.usage, chargedNanoUsd: String(rows[0].charged), production: false }));
  } finally { await app.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'LIVE_REHEARSAL_FAILED'); process.exitCode = 1; });
