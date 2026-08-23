import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';

async function loadEnvironment(path: string) {
  const content = await readFile(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

type ExecuteResult = {
  mandateId: string;
  agentId: string;
  expectedOutcome: 'COMPLETED' | 'FAILED';
  lifecycle: string[];
  evidenceRef: string;
  outputRef: string | null;
  evidenceHash: string | null;
  failure: string | null;
};

void (async () => {
  const root = resolve(process.cwd());
  await loadEnvironment(resolve(root, '.env'));
  assert.ok(process.env.JWT_SECRET, 'JWT_SECRET_REQUIRED');
  const baseUrl = process.env.AGENT_RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:3011/api/v1';
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findFirst({
      where: {
        status: 'Active',
        roles: { some: { role: { code: { in: ['company_owner', 'OWNER', 'PRODUCT_OWNER'] }, isActive: true } } },
      },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    assert.ok(user, 'ACTIVE_OWNER_OR_PRODUCT_OWNER_REQUIRED');
    const roles = user.roles
      .filter((entry) => entry.companyId === user.companyId && entry.role.companyId === user.companyId && entry.role.isActive)
      .map((entry) => entry.role.code);
    const accessToken = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync(
      { sub: user.id, companyId: user.companyId, roles, scope: 'user' },
      { expiresIn: '5m' },
    );

    const execute = async (expectedOutcome: 'COMPLETED' | 'FAILED') => {
      const response = await fetch(`${baseUrl}/agent-runtime-events/execute-inspector`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ expectedOutcome }),
      });
      const payload = await response.json() as { data?: ExecuteResult; message?: string };
      assert.equal(response.status, 201, `EXECUTE_${expectedOutcome}_HTTP_${response.status}:${payload.message ?? 'UNKNOWN'}`);
      assert.ok(payload.data, `EXECUTE_${expectedOutcome}_DATA_REQUIRED`);
      return payload.data;
    };

    const completed = await execute('COMPLETED');
    const failed = await execute('FAILED');
    assert.deepEqual(completed.lifecycle, ['STARTED', 'WORKING', 'COMPLETED']);
    assert.deepEqual(failed.lifecycle, ['STARTED', 'WORKING', 'FAILED']);
    assert.ok(completed.outputRef, 'COMPLETED_OUTPUT_REF_REQUIRED');
    assert.ok(completed.evidenceHash, 'COMPLETED_EVIDENCE_HASH_REQUIRED');
    assert.ok(failed.failure, 'FAILED_REASON_REQUIRED');

    const readResponse = await fetch(
      `${baseUrl}/agent-runtime-events?limit=50`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    const readPayload = await readResponse.json() as { data?: { events: Array<{ mandateId: string; lifecycle: string }> } };
    assert.equal(readResponse.status, 200, `READ_EVENTS_HTTP_${readResponse.status}`);
    const persisted = readPayload.data?.events ?? [];
    for (const result of [completed, failed]) {
      const lifecycle = persisted.filter((event) => event.mandateId === result.mandateId).map((event) => event.lifecycle);
      assert.deepEqual(lifecycle, result.lifecycle, `PERSISTED_${result.expectedOutcome}_LIFECYCLE`);
    }

    const evidence = {
      contract: 'agm.turn-agent-runtime-execution-endpoint-e2e.v1',
      checkedAt: new Date().toISOString(),
      apiBaseUrl: baseUrl,
      actorRole: roles.includes('company_owner') ? 'company_owner' : roles.includes('OWNER') ? 'OWNER' : 'PRODUCT_OWNER',
      completed,
      failed,
      persistenceVerified: true,
      result: 'PASS',
    };
    const evidenceRoot = resolve(root, 'evidence/turn-reality/p0-agent-runtime-live');
    await mkdir(evidenceRoot, { recursive: true });
    const evidencePath = resolve(evidenceRoot, 'execution-endpoint-e2e.json');
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
    console.log(JSON.stringify({
      result: 'PASS',
      completedMandateId: completed.mandateId,
      completedLifecycle: completed.lifecycle,
      failedMandateId: failed.mandateId,
      failedLifecycle: failed.lifecycle,
      persistenceVerified: true,
      evidencePath,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
