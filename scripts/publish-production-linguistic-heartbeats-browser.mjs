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
const heartbeatPathPattern = /\/api\/v1\/operations\/(turn\/)?components\/(premium-linguist-(?:it|es|sv))\/heartbeat$/;

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
  const auditStartedAtMs = Date.now();
  const report = {
    contract: 'agm-linguistic-release-heartbeat-publication.v2',
    startedAt: new Date(auditStartedAtMs).toISOString(),
    target: sanitizeUrl(target),
    expectedRevision,
    expectedContractVersion: LINGUISTIC_RESOURCE_CONTRACT_VERSION,
    expectedContractDigest: LINGUISTIC_RESOURCE_CONTRACT_DIGEST,
    candidateAvailable: false,
    candidateReadiness: { attempted: false, status: null },
    browser: {
      navigation: {
        attempted: false,
        pathname: sanitizePathname(target),
        status: null,
        ok: false,
      },
    },
    sessionAuthority: 'TURN_ADMIN_EXISTING_CONTRACT',
    sessionRestore: {
      states: [],
      ownerRestoreStarted: false,
      ownerRestoreCompleted: false,
      adminAccessVerified: false,
      turnHeartbeatRebindReached: false,
    },
    network: { requests: [], requestFailures: [], responses: [] },
    application: { lifecycle: [], pageErrors: [], console: [] },
    observer: {
      expectedAgentIds: [...agentIds],
      receivedAgentIds: [],
      progression: [],
      errors: [],
      finalState: `0/${agentIds.length}`,
    },
    stages: [],
    agents: [],
    status: 'FAIL',
  };
  const received = new Map();
  const requestStartedAt = new WeakMap();
  let browser;
  let context;
  let page;
  let session;
  let turnAdminApiBaseUrl;
  const elapsedMs = () => Date.now() - auditStartedAtMs;
  const recordLifecycle = (event) => {
    if (!event || typeof event !== 'object') return;
    report.application.lifecycle.push(sanitizeLifecycleEvent(event, elapsedMs()));
  };
  try {
    if (!target) throw new Error('AGM_LINGUISTIC_RELEASE_URL_REQUIRED');
    if (!pin?.trim()) throw new Error('AGM_TURN_ADMIN_PIN_REQUIRED');
    turnAdminApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl ?? new URL('/api/v1', target).href);

    report.candidateReadiness.attempted = true;
    const readiness = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    report.candidateReadiness.status = readiness.status;
    if (!readiness.ok) throw new Error(`WEB_CANDIDATE_UNAVAILABLE_HTTP_${readiness.status}`);
    report.candidateAvailable = true;

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ serviceWorkers: 'block' });
    page = await context.newPage();
    await page.exposeBinding('__agmRecordCertificationDiagnostic', (_source, event) => {
      recordLifecycle(event);
    });
    await page.addInitScript(installBrowserDiagnostics);
    attachPageDiagnostics(page, report, received, requestStartedAt, elapsedMs);
    await configurePage?.(page);

    report.browser.navigation.attempted = true;
    report.browser.navigation.startedAt = new Date().toISOString();
    const navigation = await page.goto(target, { waitUntil: 'domcontentloaded' });
    report.browser.navigation.completedAt = new Date().toISOString();
    report.browser.navigation.status = navigation?.status() ?? 0;
    report.browser.navigation.ok = Boolean(navigation?.ok());
    report.browser.navigation.pathname = sanitizePathname(navigation?.url() ?? target);
    report.browser.navigation.readyState = await page.evaluate(() => document.readyState);
    report.browser.navigation.visibilityState = await page.evaluate(() => document.visibilityState);
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
    report.error = sanitizeDiagnosticText(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    if (page && !page.isClosed()) {
      await page.waitForTimeout(50).catch(() => undefined);
      const finalSnapshot = await sessionRestoreSnapshot(page, 'FINALLY_BEFORE_LOGOUT').catch(() => null);
      if (finalSnapshot) report.sessionRestore.states.push(finalSnapshot);
    }
    finalizeDiagnostics(report, received);
    if (page && !page.isClosed() && session?.accessToken && turnAdminApiBaseUrl) {
      await page.evaluate(async ({ accessToken, turnAdminApiBaseUrl: runtimeApiBaseUrl }) => {
        await fetch(`${runtimeApiBaseUrl}/turn-admin/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => undefined);
      }, { accessToken: session.accessToken, turnAdminApiBaseUrl }).catch(() => undefined);
    }
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
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
    observerFinalState: report.observer.finalState,
    agents: report.agents.map(({ agentId, httpStatus, accepted }) => ({ agentId, httpStatus, accepted })),
    evidencePath,
  }));
}

function attachPageDiagnostics(page, report, received, requestStartedAt, elapsedMs) {
  page.on('pageerror', (error) => {
    report.application.pageErrors.push({
      atMs: elapsedMs(),
      message: sanitizeDiagnosticText(error instanceof Error ? error.message : String(error)),
    });
  });
  page.on('console', (message) => {
    if (!['warning', 'error'].includes(message.type())) return;
    const text = sanitizeDiagnosticText(message.text());
    if (!isRelevantConsoleDiagnostic(text)) return;
    report.application.console.push({ atMs: elapsedMs(), level: message.type(), message: text });
  });
  page.on('request', (request) => {
    const metadata = heartbeatRequestMetadata(request.url());
    if (!metadata) return;
    const atMs = elapsedMs();
    requestStartedAt.set(request, atMs);
    report.network.requests.push({
      atMs,
      observedAt: new Date().toISOString(),
      method: request.method(),
      pathname: metadata.pathname,
      agentId: metadata.agentId,
      authority: metadata.authority,
    });
  });
  page.on('requestfailed', (request) => {
    const metadata = heartbeatRequestMetadata(request.url());
    if (!metadata) return;
    const atMs = elapsedMs();
    const startedAtMs = requestStartedAt.get(request);
    report.network.requestFailures.push({
      atMs,
      observedAt: new Date().toISOString(),
      durationMs: Number.isFinite(startedAtMs) ? atMs - startedAtMs : null,
      method: request.method(),
      pathname: metadata.pathname,
      agentId: metadata.agentId,
      authority: metadata.authority,
      failure: sanitizeDiagnosticText(request.failure()?.errorText ?? 'REQUEST_FAILED'),
    });
  });
  page.on('response', (response) => {
    void observeHeartbeatResponse(response, report, received, requestStartedAt, elapsedMs);
  });
}

async function observeHeartbeatResponse(response, report, received, requestStartedAt, elapsedMs) {
  const request = response.request();
  if (request.method() !== 'POST') return;
  const metadata = heartbeatRequestMetadata(response.url());
  if (!metadata) return;
  const atMs = elapsedMs();
  const startedAtMs = requestStartedAt.get(request);
  report.network.responses.push({
    atMs,
    observedAt: new Date().toISOString(),
    durationMs: Number.isFinite(startedAtMs) ? atMs - startedAtMs : null,
    pathname: metadata.pathname,
    agentId: metadata.agentId,
    authority: metadata.authority,
    httpStatus: response.status(),
  });
  if (metadata.authority !== 'turn-admin-session' || received.has(metadata.agentId)) return;
  try {
    const requestBody = request.postDataJSON();
    received.set(metadata.agentId, {
      agentId: metadata.agentId,
      httpStatus: response.status(),
      request: requestBody,
    });
    report.observer.progression.push({
      atMs,
      agentId: metadata.agentId,
      httpStatus: response.status(),
      receivedSize: received.size,
      state: `${received.size}/${agentIds.length}`,
    });
  } catch (error) {
    report.observer.errors.push({
      atMs,
      agentId: metadata.agentId,
      error: sanitizeDiagnosticText(error instanceof Error ? error.message : String(error)),
    });
  }
}

function installBrowserDiagnostics() {
  const emit = (type, detail = {}) => {
    const event = {
      type,
      browserTimestampMs: Date.now(),
      readyState: document.readyState,
      visibilityState: document.visibilityState,
      pathname: location.pathname,
      ...detail,
    };
    void globalThis.__agmRecordCertificationDiagnostic?.(event);
  };
  const heartbeatPattern = /\/api\/v1\/operations\/(turn\/)?components\/(premium-linguist-(?:it|es|sv))\/heartbeat$/;
  const refreshPathPattern = /\/api\/v1\/turn-admin\/refresh$/;
  const originalFetch = globalThis.fetch;
  const originalStorageSetItem = Storage.prototype.setItem;
  const runtimeAgents = new Set();
  let ownerRestoreStarted = false;
  let ownerRestoreRefreshSucceeded = false;
  let ownerRestoreCompleted = false;
  Storage.prototype.setItem = function diagnosticStorageSetItem(key, value) {
    const result = Reflect.apply(originalStorageSetItem, this, [key, value]);
    if (
      !ownerRestoreCompleted
      && ownerRestoreStarted
      && ownerRestoreRefreshSucceeded
      && this === sessionStorage
      && key === 'agm.admin.session'
    ) {
      ownerRestoreCompleted = true;
      emit('OWNER_RESTORE_COMPLETED', { ownerSessionPresent: true });
    }
    return result;
  };
  globalThis.fetch = async function diagnosticFetch(input, init) {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const pathname = new URL(rawUrl, location.href).pathname;
    const heartbeatMatch = pathname.match(heartbeatPattern);
    const isOwnerRefresh = refreshPathPattern.test(pathname);
    if (isOwnerRefresh) {
      ownerRestoreStarted = true;
      emit('OWNER_RESTORE_STARTED', { method: init?.method ?? input?.method ?? 'GET' });
    }
    if (heartbeatMatch) {
      const agentId = heartbeatMatch[2];
      const authority = heartbeatMatch[1] ? 'turn-admin-session' : 'user-session';
      if (!runtimeAgents.has(agentId)) {
        runtimeAgents.add(agentId);
        emit('LINGUISTIC_RUNTIME_STARTED', { agentId, authority, pathname });
      }
      emit('LINGUISTIC_HEARTBEAT_PUBLICATION_ATTEMPT', { agentId, authority, pathname });
    }
    try {
      const response = await Reflect.apply(originalFetch, this, [input, init]);
      if (isOwnerRefresh) {
        ownerRestoreRefreshSucceeded = response.ok;
        emit('OWNER_RESTORE_REFRESH_RESPONSE', { status: response.status, ok: response.ok });
      }
      if (heartbeatMatch) {
        emit('LINGUISTIC_HEARTBEAT_FETCH_RESOLVED', {
          agentId: heartbeatMatch[2],
          authority: heartbeatMatch[1] ? 'turn-admin-session' : 'user-session',
          pathname,
          status: response.status,
          ok: response.ok,
        });
      }
      return response;
    } catch (error) {
      if (isOwnerRefresh) emit('OWNER_RESTORE_REFRESH_REJECTED', { errorName: error?.name ?? 'Error' });
      if (heartbeatMatch) {
        emit('LINGUISTIC_HEARTBEAT_FETCH_REJECTED', {
          agentId: heartbeatMatch[2],
          authority: heartbeatMatch[1] ? 'turn-admin-session' : 'user-session',
          pathname,
          errorName: error?.name ?? 'Error',
        });
      }
      throw error;
    }
  };

  let administratorCheckpointRecorded = false;
  const inspectAdministratorCheckpoint = () => {
    const adminLoginPresent = Boolean(document.querySelector('#adminLoginForm'));
    const turnCommandCenterPresent = Boolean(document.querySelector('.turn-command-center'));
    if (administratorCheckpointRecorded || !turnCommandCenterPresent || adminLoginPresent) return;
    administratorCheckpointRecorded = true;
    emit('ADMIN_ACCESS_VERIFIED_TRUE', { adminLoginPresent, turnCommandCenterPresent });
    emit('TURN_HEARTBEAT_REBIND_REACHED', {
      evidenceBasis: 'TURN_COMMAND_CENTER_RENDERED_AFTER_SYNCHRONOUS_REBIND_CHECKPOINT',
    });
  };
  document.addEventListener('DOMContentLoaded', inspectAdministratorCheckpoint);
  const observeAdministratorCheckpoint = () => {
    if (!document.documentElement) return;
    new MutationObserver(inspectAdministratorCheckpoint).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };
  if (document.documentElement) observeAdministratorCheckpoint();
  else document.addEventListener('DOMContentLoaded', observeAdministratorCheckpoint, { once: true });
  queueMicrotask(inspectAdministratorCheckpoint);
}

function finalizeDiagnostics(report, received) {
  const lifecycleTypes = new Set(report.application.lifecycle.map(({ type }) => type));
  report.sessionRestore.ownerRestoreStarted = lifecycleTypes.has('OWNER_RESTORE_STARTED');
  report.sessionRestore.ownerRestoreCompleted = lifecycleTypes.has('OWNER_RESTORE_COMPLETED');
  report.sessionRestore.adminAccessVerified = lifecycleTypes.has('ADMIN_ACCESS_VERIFIED_TRUE');
  report.sessionRestore.turnHeartbeatRebindReached = lifecycleTypes.has('TURN_HEARTBEAT_REBIND_REACHED');
  report.observer.receivedAgentIds = agentIds.filter((agentId) => received.has(agentId));
  report.observer.finalState = `${received.size}/${agentIds.length}`;

  const lifecycleAgents = (type, authority) => new Set(
    report.application.lifecycle
      .filter((event) => event.type === type && (!authority || event.authority === authority))
      .map((event) => event.agentId),
  );
  const networkAgents = (events, authority) => new Set(
    events.filter((event) => !authority || event.authority === authority).map((event) => event.agentId),
  );
  const allAgents = (observed) => agentIds.every((agentId) => observed.has(agentId));
  const runtimeAgents = lifecycleAgents('LINGUISTIC_RUNTIME_STARTED');
  const attemptAgents = lifecycleAgents('LINGUISTIC_HEARTBEAT_PUBLICATION_ATTEMPT', 'turn-admin-session');
  const requestedAgents = networkAgents(report.network.requests, 'turn-admin-session');
  const responseAgents = networkAgents(report.network.responses, 'turn-admin-session');
  const acceptedAgents = new Set(
    report.network.responses
      .filter((event) => event.authority === 'turn-admin-session' && event.httpStatus === 201)
      .map((event) => event.agentId),
  );
  const checks = [
    ['candidate browser page opens', report.browser.navigation.ok],
    ['Owner/session restoration starts', report.sessionRestore.ownerRestoreStarted],
    ['Owner restoration succeeds', report.sessionRestore.ownerRestoreCompleted],
    ['adminAccessVerified becomes true', report.sessionRestore.adminAccessVerified],
    ['linguistic heartbeat transport rebinding executes', report.sessionRestore.turnHeartbeatRebindReached],
    ['IT/ES/SV linguistic runtimes start', allAgents(runtimeAgents)],
    ['each runtime attempts TURN heartbeat publication', allAgents(attemptAgents)],
    ['TURN heartbeat HTTP request is emitted', allAgents(requestedAgents)],
    ['TURN heartbeat HTTP response/status is received', allAgents(responseAgents)],
    ['TURN heartbeat is accepted by Production', allAgents(acceptedAgents)],
  ];
  let priorStagePassed = true;
  report.stages = checks.map(([name, passed], index) => {
    const status = passed ? 'PASS' : priorStagePassed ? 'FAIL' : 'NOT_REACHED';
    priorStagePassed &&= Boolean(passed);
    return { stage: index + 1, name, status };
  });
}

function heartbeatRequestMetadata(value) {
  const pathname = sanitizePathname(value);
  const match = pathname.match(heartbeatPathPattern);
  if (!match) return null;
  return {
    pathname,
    agentId: match[2],
    authority: match[1] ? 'turn-admin-session' : 'user-session',
  };
}

function sanitizeLifecycleEvent(event, fallbackAtMs) {
  const sanitized = {
    type: sanitizeDiagnosticText(event.type ?? 'UNKNOWN'),
    atMs: fallbackAtMs,
    browserTimestampMs: Number.isFinite(event.browserTimestampMs) ? event.browserTimestampMs : null,
    readyState: sanitizeDiagnosticText(event.readyState ?? ''),
    visibilityState: sanitizeDiagnosticText(event.visibilityState ?? ''),
    pathname: sanitizePathname(event.pathname),
  };
  for (const key of ['agentId', 'authority', 'method', 'errorName', 'evidenceBasis']) {
    if (typeof event[key] === 'string') sanitized[key] = sanitizeDiagnosticText(event[key]);
  }
  if (Number.isFinite(event.status)) sanitized.status = event.status;
  for (const key of ['ok', 'ownerSessionPresent', 'adminLoginPresent', 'turnCommandCenterPresent']) {
    if (typeof event[key] === 'boolean') sanitized[key] = event[key];
  }
  return sanitized;
}

function sanitizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return sanitizeDiagnosticText(value).replace(/[?#].*$/, '');
  }
}

function sanitizePathname(value) {
  if (!value) return '';
  try {
    return new URL(value, 'https://diagnostic.invalid').pathname;
  } catch {
    return String(value).split(/[?#]/, 1)[0].slice(0, 500);
  }
}

function sanitizeDiagnosticText(value) {
  return String(value ?? '')
    .replace(/\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi, '[REDACTED_AUTH_HEADER]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
    .replace(/((?:access|refresh)[_-]?token|authorization|cookie|pin)(\s*[=:]\s*)[^\s,;&]+/gi, '$1$2[REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|authorization|pin)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\bAuthorization\b/gi, '[REDACTED_AUTH_HEADER]')
    .slice(0, 1_000);
}

function isRelevantConsoleDiagnostic(message) {
  return /(owner|admin|session|heartbeat|linguist|turn|auth)/i.test(message);
}

function normalizeApiBaseUrl(value) {
  const normalized = value?.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('AGM_LINGUISTIC_RELEASE_API_URL_REQUIRED');
  return normalized;
}

async function sessionRestoreSnapshot(page, phase) {
  return page.evaluate((currentPhase) => {
    let ownerSessionPresent = false;
    try {
      ownerSessionPresent = Boolean(sessionStorage.getItem('agm.admin.session'));
    } catch {
      ownerSessionPresent = false;
    }
    const adminLoginPresent = Boolean(document.querySelector('#adminLoginForm'));
    const turnCommandCenterPresent = Boolean(document.querySelector('.turn-command-center'));
    return {
      phase: currentPhase,
      readyState: document.readyState,
      visibilityState: document.visibilityState,
      ownerSessionPresent: ownerSessionPresent ? 'yes' : 'no',
      adminLoginPresent: adminLoginPresent ? 'yes' : 'no',
      turnCommandCenterPresent: turnCommandCenterPresent ? 'yes' : 'no',
    };
  }, phase);
}
