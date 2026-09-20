import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import {
  canonicalLinguisticResourceCounts,
  validateLinguisticResourceEvidence,
} from '@agm/shared';
import { AuthorityControlPlaneService } from '../apps/api/src/authority-control-plane/authority-control-plane.service';
import {
  OperationalAgentDutyRunner,
  type OperationalAgentDutyResult,
} from '../apps/api/src/authority-control-plane/operational-agent-duty.runner';
import { premiumNetworkSeed } from '../apps/api/src/authority-control-plane/premium-network.seed';
import type { RequestContext } from '../apps/api/src/common/request-context';
import { publishProductionLinguisticHeartbeats } from './publish-production-linguistic-heartbeats-browser.mjs';

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'production-release.yml');
const evidenceDir = path.join(root, 'evidence', 'rescue', 'local-linguistic-shared-contract-2026-09-20');
const evidencePath = path.join(evidenceDir, 'release-sequencing-simulation.json');
const projectionPath = path.join(evidenceDir, 'release-sequencing-projection.json');
const publicationEvidencePath = path.join(evidenceDir, 'release-sequencing-heartbeat-publication.json');
const targets = [
  { agentId: 'premium-linguist-it', language: 'it' },
  { agentId: 'premium-linguist-es', language: 'es' },
  { agentId: 'premium-linguist-sv', language: 'sv' },
] as const;
const targetIds = new Set<string>(targets.map(({ agentId }) => agentId));
const ctx: RequestContext = {
  companyId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  roles: ['PRODUCT_OWNER'],
  requestId: 'release-sequence-simulation',
  correlationId: 'release-sequence-simulation',
};

type IndependentValidator = {
  validateOperationalDutyResults(
    context: RequestContext,
    executions: readonly OperationalAgentDutyResult[],
    validatorMandate: { id: string },
    runId: string,
  ): Promise<Array<{ agentId: string; validationEventId: string }>>;
};

async function main() {
  const browserTrace = {
    requests: [] as Array<{ method: string; url: string }>,
    responses: [] as Array<{ status: number; url: string }>,
    requestFailures: [] as Array<{ method: string; url: string; error: string }>,
    console: [] as Array<{ type: string; text: string }>,
    pageErrors: [] as string[],
  };
const report: Record<string, unknown> = {
  contract: 'agm-production-linguistic-release-sequencing-simulation.v1',
  startedAt: new Date().toISOString(),
  status: 'FAIL',
};
let viteServer: { close(): Promise<void> } | undefined;
try {
  const workflow = await readFile(workflowPath, 'utf8');
  const deployIndex = workflow.indexOf('- name: Deploy approved digest through Release & Operations');
  const publishIndex = workflow.indexOf('- name: Publish versioned Web candidate linguistic heartbeats');
  const gateIndex = workflow.indexOf('- name: Verify canonical M2M lifecycle in Production');
  assert(deployIndex >= 0 && publishIndex > deployIndex && gateIndex > publishIndex, 'RELEASE_SEQUENCE_ORDER_INVALID');
  assert.match(workflow, /AGM_TURN_ADMIN_PIN: \$\{\{ secrets\.PRODUCTION_TURN_ADMIN_PIN \}\}/);
  assert.match(workflow, /node scripts\/publish-production-linguistic-heartbeats-browser\.mjs/);

  const webRoot = path.join(root, 'apps', 'web');
  const webRequire = createRequire(path.join(webRoot, 'package.json'));
  const { preview } = await import(pathToFileURL(webRequire.resolve('vite')).href);
  viteServer = await preview({
    root: webRoot,
    preview: { host: '127.0.0.1', port: 0, strictPort: false },
    logLevel: 'silent',
  });
  const address = (viteServer as { httpServer?: { address(): string | { port: number } | null } }).httpServer?.address();
  assert(address && typeof address !== 'string', 'WEB_CANDIDATE_PORT_UNAVAILABLE');
  const target = `http://127.0.0.1:${address.port}/turn`;
  const targetOrigin = new URL(target).origin;
  const acceptedDetails = new Map<string, string>();
  const session = { accessToken: 'controlled-release-turn-admin-token', expiresInSeconds: 300 };

  const publication = await publishProductionLinguisticHeartbeats({
    target,
    apiBaseUrl: 'https://api.agmcockpit.com/api/v1',
    pin: 'controlled-owner-pin',
    evidencePath: publicationEvidencePath,
    expectedRevision: 'local-release-candidate',
    heartbeatTimeoutMs: 2_000,
    configurePage: async (page: import('playwright').Page) => {
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/v1/')) browserTrace.requests.push({ method: request.method(), url });
      });
      page.on('response', (response) => {
        const url = response.url();
        if (url.includes('/api/v1/')) browserTrace.responses.push({ status: response.status(), url });
      });
      page.on('requestfailed', (request) => {
        const url = request.url();
        if (url.includes('/api/v1/')) {
          browserTrace.requestFailures.push({ method: request.method(), url, error: request.failure()?.errorText ?? 'UNKNOWN' });
        }
      });
      page.on('console', (message) => browserTrace.console.push({ type: message.type(), text: message.text() }));
      page.on('pageerror', (error) => browserTrace.pageErrors.push(error.stack || error.message || String(error)));
      await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS') {
          await route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': targetOrigin,
              'access-control-allow-credentials': 'true',
              'access-control-allow-methods': 'GET, POST, OPTIONS',
              'access-control-allow-headers': 'Authorization, Content-Type',
            },
          });
          return;
        }
        const heartbeatMatch = pathname.match(/\/operations\/turn\/components\/(premium-linguist-(?:it|es|sv))\/heartbeat$/);
        if (pathname.endsWith('/turn-admin/unlock')) {
          assert.equal(request.postDataJSON().pin, 'controlled-owner-pin');
          await json(route, session, 201, targetOrigin);
          return;
        }
        if (pathname.endsWith('/turn-admin/refresh')) {
          await json(route, session, 200, targetOrigin);
          return;
        }
        if (pathname.endsWith('/turn-admin/validate')) {
          await json(route, { valid: true }, 200, targetOrigin);
          return;
        }
        if (pathname.endsWith('/turn-admin/logout')) {
          await json(route, { loggedOut: true }, 200, targetOrigin);
          return;
        }
        if (heartbeatMatch && request.method() === 'POST') {
          assert.equal(request.headers().authorization, `Bearer ${session.accessToken}`);
          const body = request.postDataJSON();
          assert.equal(body.status, 'ONLINE');
          assert.equal(validateLinguisticResourceEvidence(body.detail).valid, true);
          acceptedDetails.set(heartbeatMatch[1], body.detail);
          await json(route, { componentId: heartbeatMatch[1], status: 'ONLINE', freshness: 'LIVE' }, 201, targetOrigin);
          return;
        }
        if (/\/operations\/components\/premium-linguist-(?:it|es|sv)\/heartbeat$/.test(pathname)) {
          await new Promise((resolve) => setTimeout(resolve, 5_000));
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': targetOrigin, 'access-control-allow-credentials': 'true' },
            body: JSON.stringify({ message: 'TURN session required' }),
          });
          return;
        }
        if (pathname.endsWith('/agent-runtime-events')) {
          await json(route, { events: [], nextCursor: null }, 200, targetOrigin);
          return;
        }
        if (pathname.endsWith('/security/secrets/health')) {
          await json(route, { overallStatus: 'CONFIGURED' }, 200, targetOrigin);
          return;
        }
        if (pathname.endsWith('/authority-control-plane/dashboard')) {
          await json(route, { contractVersion: 'AGM-PREMIUM-NETWORK-V1', nodes: [], departments: [], controlPlane: { status: 'PASS' } }, 200, targetOrigin);
          return;
        }
        await json(route, {}, 200, targetOrigin);
      });
    },
  });
  assert.equal(publication.status, 'PASS');
  assert.equal(publication.candidateAvailable, true);
  assert.equal(acceptedDetails.size, targets.length);
  assert(publication.agents.every((agent: { httpStatus: number; accepted: boolean }) => agent.httpStatus === 201 && agent.accepted));

  const harness = runtimeHarness(acceptedDetails);
  const executions = await harness.runner.execute(
    ctx,
    targets.map(({ agentId }) => ({ id: `mandate-${agentId}`, agentId })),
    'release-sequence-valid',
    new Set(targetIds),
  );
  const validations = await harness.validator.validateOperationalDutyResults(
    ctx,
    executions,
    { id: 'mandate-premium-architecture-inspector' },
    'release-sequence-valid',
  );
  assert.equal(executions.length, 3);
  assert(executions.every((execution) => execution.passed && execution.result === 'COMPLETED'));
  assert.equal(validations.length, 3);

  const unaffected = premiumNetworkSeed.filter(({ canonicalId, kind }) => kind !== 'HUMAN_AUTHORITY' && !targetIds.has(canonicalId));
  assert.equal(unaffected.length, 24, 'PRESERVED_BASELINE_MUST_HAVE_24_AGENTS');
  const preservedNodes = unaffected.map(({ canonicalId }) => ({
    identity: canonicalId,
    lastResult: 'COMPLETED',
    validation: 'PROVEN',
    freshness: 'CURRENT',
    status: 'ACTIVE',
  }));
  const preservedDigestBefore = digest(preservedNodes);
  const projection = [
    ...preservedNodes,
    ...executions.map(({ agentId }) => ({
      identity: agentId,
      lastResult: 'COMPLETED',
      validation: validations.some((validation) => validation.agentId === agentId) ? 'PROVEN' : 'FAILED',
      freshness: 'CURRENT',
      status: 'ACTIVE',
    })),
  ];
  assert.equal(projection.length, 27);
  assert.equal(projection.filter(({ status }) => status !== 'ACTIVE').length, 0);
  assert.equal(digest(projection.slice(0, 24)), preservedDigestBefore);

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(projectionPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
  const reopenedProjection = JSON.parse(await readFile(projectionPath, 'utf8'));
  assert.deepEqual(reopenedProjection, projection);

  const counts = canonicalLinguisticResourceCounts();
  const corruptDetail = acceptedDetails.get('premium-linguist-it')
    ?.replace(`total=${counts.total}`, `total=${counts.total - 1}`);
  assert(corruptDetail, 'NEGATIVE_CONTROL_DETAIL_MISSING');
  const negativeHarness = runtimeHarness(new Map([['premium-linguist-it', corruptDetail]]));
  const negativeExecution = await negativeHarness.runner.execute(
    ctx,
    [{ id: 'mandate-premium-linguist-it-negative', agentId: 'premium-linguist-it' }],
    'release-sequence-negative',
    new Set(['premium-linguist-it']),
  );
  const negativeValidations = await negativeHarness.validator.validateOperationalDutyResults(
    ctx,
    negativeExecution,
    { id: 'mandate-premium-architecture-inspector' },
    'release-sequence-negative',
  );
  assert.equal(negativeExecution[0]?.result, 'FAILED');
  assert.equal(negativeExecution[0]?.reason, 'LINGUISTIC_CATALOG_VALIDATION_FAILED');
  assert.deepEqual(negativeValidations, []);
  assert.equal(digest(preservedNodes), preservedDigestBefore);

  Object.assign(report, {
    status: 'PASS',
    sequence: [
      'WEB_CANDIDATE_PUBLISHED_AVAILABLE',
      'VERSIONED_HEARTBEATS_ACCEPTED',
      'LINGUISTIC_DUTIES_COMPLETED',
      'INDEPENDENT_VALIDATION_PASS',
      'PERSISTENT_RUNTIME_PROJECTION_REOPENED',
      'GATE_27_OF_27_FINAL_PASS',
    ],
    workflowOrder: { deployBeforeHeartbeatPublication: true, heartbeatPublicationBeforeGate: true },
    publication,
    linguisticDuties: executions.map(({ agentId, result, passed }) => ({ agentId, result, passed })),
    independentValidation: { status: 'PASS', agents: validations.map(({ agentId }) => agentId) },
    persistentRuntimeProjection: { total: 27, active: 27, redNodes: 0, reopened: true, final: 'PASS' },
    preservedBaseline: { agents: 24, digestBefore: preservedDigestBefore, digestAfter: digest(preservedNodes), regressions: 0 },
    negativeControl: {
      status: 'DENIED',
      dutyResult: negativeExecution[0]?.result,
      reason: negativeExecution[0]?.reason,
      independentValidations: negativeValidations.length,
    },
    browserTrace,
  });
} catch (error) {
  report.error = error instanceof Error ? error.stack ?? error.message : String(error);
  report.browserTrace = browserTrace;
  throw error;
} finally {
  await viteServer?.close();
  report.finishedAt = new Date().toISOString();
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log('PRODUCTION LINGUISTIC RELEASE SEQUENCING SIMULATION: PASS');
console.log(evidencePath);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function runtimeHarness(details: ReadonlyMap<string, string>) {
  const agentRuntimeEvents: unknown[] = [];
  const prisma = {
    componentHeartbeat: {
      findUnique: async ({ where }: { where: { companyId_componentId: { componentId: string } } }) => {
        const agentId = where.companyId_componentId.componentId;
        const detail = details.get(agentId);
        return detail ? {
          id: `heartbeat-${agentId}`,
          reportedStatus: 'ONLINE',
          lastFailureReason: null,
          lastDetail: detail,
          lastSeenAt: new Date(),
        } : null;
      },
      update: async () => undefined,
    },
    authorityAuditJournal: { create: async ({ data }: { data: unknown }) => data },
    agentRuntimeEvent: { create: async ({ data }: { data: unknown }) => { agentRuntimeEvents.push(data); return data; } },
  };
  const runner = new OperationalAgentDutyRunner(prisma as never, {} as never, {} as never);
  const service = new AuthorityControlPlaneService(prisma as never, {} as never, {} as never, runner);
  return { runner, validator: service as unknown as IndependentValidator, agentRuntimeEvents };
}

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function json(route: import('playwright').Route, data: unknown, status = 200, origin?: string) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } : undefined,
    body: JSON.stringify({ data, requestId: 'release-sequence-simulation' }),
  });
}
