import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as sharedContractNamespace from '../packages/shared/dist/index.js';

const sharedContract = sharedContractNamespace.default ?? sharedContractNamespace;
const {
  LINGUISTIC_RESOURCE_CONTRACT_DIGEST,
  LINGUISTIC_RESOURCE_CONTRACT_VERSION,
  validateLinguisticResourceEvidence,
} = sharedContract;

const agentIds = [
  'premium-linguist-it',
  'premium-linguist-es',
  'premium-linguist-sv',
];

export async function publishProductionLinguisticHeartbeats(options) {
  const {
    target,
    pin,
    evidencePath,
    expectedRevision = '',
    configurePage,
    apiBaseUrl,
    heartbeatTimeoutMs = 30_000,
  } = options;
  if (!target) throw new Error('AGM_LINGUISTIC_RELEASE_URL_REQUIRED');
  if (!pin?.trim()) throw new Error('AGM_TURN_ADMIN_PIN_REQUIRED');
  const turnAdminApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl ?? new URL('/api/v1', target).href);

  const report = {
    contract: 'agm-linguistic-release-heartbeat-publication.v1',
    startedAt: new Date().toISOString(),
    target,
    expectedRevision,
    expectedContractVersion: LINGUISTIC_RESOURCE_CONTRACT_VERSION,
    expectedContractDigest: LINGUISTIC_RESOURCE_CONTRACT_DIGEST,
    candidateAvailable: false,
    sessionAuthority: 'TURN_ADMIN_EXISTING_CONTRACT',
    sessionRestore: { states: [] },
    agents: [],
    status: 'FAIL',
  };
  const received = new Map();
  let browser;
  let context;
  let page;
  let session;
  try {
    const readiness = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    if (!readiness.ok) throw new Error(`WEB_CANDIDATE_UNAVAILABLE_HTTP_${readiness.status}`);
    report.candidateAvailable = true;

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ serviceWorkers: 'block' });
    page = await context.newPage();
    await configurePage?.(page);
    page.on('response', async (response) => {
      const request = response.request();
      if (request.method() !== 'POST') return;
      const pathname = new URL(response.url()).pathname;
      const match = pathname.match(/\/api\/v1\/operations\/turn\/components\/(premium-linguist-(?:it|es|sv))\/heartbeat$/);
      if (!match || received.has(match[1])) return;
      const requestBody = request.postDataJSON();
      const responseBody = await response.json().catch(() => null);
      received.set(match[1], {
        agentId: match[1],
        httpStatus: response.status(),
        request: requestBody,
        response: responseBody,
      });
    });

    const navigation = await page.goto(target, { waitUntil: 'domcontentloaded' });
    if (!navigation?.ok()) throw new Error(`WEB_CANDIDATE_NAVIGATION_HTTP_${navigation?.status() ?? 0}`);
    const unlock = await page.evaluate(async ({ ownerPin, turnAdminApiBaseUrl: runtimeApiBaseUrl }) => {
      const response = await fetch(`${runtimeApiBaseUrl}/turn-admin/unlock`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: ownerPin }),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    }, { ownerPin: pin, turnAdminApiBaseUrl });
    if (unlock.status !== 200 && unlock.status !== 201) throw new Error(`TURN_ADMIN_UNLOCK_HTTP_${unlock.status}`);
    session = unlock.body?.data;
    if (!session?.accessToken || !Number.isFinite(session.expiresInSeconds)) throw new Error('TURN_ADMIN_SESSION_INVALID');
    await page.evaluate((value) => {
      sessionStorage.setItem('agm.admin.session', JSON.stringify(value));
    }, session);
    await page.reload({ waitUntil: 'domcontentloaded' });
    report.sessionRestore.states.push(await sessionRestoreSnapshot(page, 'RELOAD_DOM_CONTENT_LOADED'));
    await page.waitForTimeout(1_000);
    report.sessionRestore.states.push(await sessionRestoreSnapshot(page, 'RELOAD_PLUS_1_SECOND'));

    const deadline = Date.now() + heartbeatTimeoutMs;
    while (received.size < agentIds.length && Date.now() < deadline) await page.waitForTimeout(100);
    report.sessionRestore.states.push(await sessionRestoreSnapshot(page, 'HEARTBEAT_DEADLINE'));
    if (received.size !== agentIds.length) throw new Error(`LINGUISTIC_HEARTBEATS_INCOMPLETE_${received.size}_OF_${agentIds.length}`);

    for (const agentId of agentIds) {
      const item = received.get(agentId);
      const validation = validateLinguisticResourceEvidence(String(item?.request?.detail ?? ''));
      if (item?.httpStatus !== 201) throw new Error(`${agentId}_HEARTBEAT_HTTP_${item?.httpStatus ?? 0}`);
      if (item.request?.status !== 'ONLINE') throw new Error(`${agentId}_HEARTBEAT_NOT_ONLINE`);
      if (!validation.valid) throw new Error(`${agentId}_SHARED_CONTRACT_INVALID`);
      report.agents.push({
        agentId,
        httpStatus: item.httpStatus,
        status: item.request.status,
        reason: item.request.reason,
        contractVersionMatches: validation.contractVersionMatches,
        contractDigestMatches: validation.contractDigestMatches,
        componentsMatch: validation.componentsMatchCanonical,
        totalMatchesComponents: validation.totalMatchesComponents,
        errorsZero: validation.errorsZero,
        accepted: true,
      });
    }
    report.status = 'PASS';
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (page && session?.accessToken) {
      await page.evaluate(async ({ accessToken, turnAdminApiBaseUrl: runtimeApiBaseUrl }) => {
        await fetch(`${runtimeApiBaseUrl}/turn-admin/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => undefined);
      }, { accessToken: session.accessToken, turnAdminApiBaseUrl }).catch(() => undefined);
    }
    await context?.close();
    await browser?.close();
    report.finishedAt = new Date().toISOString();
    if (evidencePath) {
      await mkdir(path.dirname(evidencePath), { recursive: true });
      await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
  }
  return report;
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsScript) {
  void runCli();
}

async function runCli() {
  const target = process.env.AGM_LINGUISTIC_RELEASE_URL?.trim();
  if (!target?.startsWith('https://')) throw new Error('PRODUCTION_LINGUISTIC_RELEASE_URL_MUST_USE_HTTPS');
  const evidencePath = path.resolve(
    process.env.AGM_LINGUISTIC_RELEASE_EVIDENCE
      ?? 'evidence/agent-accountability/production/linguistic-heartbeat-publication.json',
  );
  const report = await publishProductionLinguisticHeartbeats({
    target,
    pin: process.env.AGM_TURN_ADMIN_PIN,
    evidencePath,
    expectedRevision: process.env.AGM_EXPECTED_REVISION ?? '',
    apiBaseUrl: process.env.AGM_LINGUISTIC_RELEASE_API_URL,
  });
  console.log(JSON.stringify({
    status: report.status,
    candidateAvailable: report.candidateAvailable,
    agents: report.agents.map(({ agentId, httpStatus, accepted }) => ({ agentId, httpStatus, accepted })),
    evidencePath,
  }));
}

function normalizeApiBaseUrl(value) {
  const normalized = value?.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('AGM_LINGUISTIC_RELEASE_API_URL_REQUIRED');
  return normalized;
}

async function sessionRestoreSnapshot(page, phase) {
  return page.evaluate((currentPhase) => ({
    phase: currentPhase,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    sessionStored: Boolean(sessionStorage.getItem('agm.admin.session')),
    adminLoginPresent: Boolean(document.querySelector('#adminLoginForm')),
    turnCommandCenterPresent: Boolean(document.querySelector('.turn-command-center')),
  }), phase);
}
