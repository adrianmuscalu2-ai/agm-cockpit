import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.AGM_ANDROID_CDP ?? 'http://127.0.0.1:9223';
const requestedRoute = process.env.AGM_ANDROID_AUDIT_ROUTE ?? null;
const outputPath = process.env.AGM_TURN_AUDIT_OUTPUT ?? null;
const report = {
  checkedAt: new Date().toISOString(),
  endpoint,
  transport: 'android-webview-direct-cdp',
  status: 'FAIL',
};

let socket;
try {
  const targets = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(15_000) }).then((response) => response.json());
  const target = targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
  if (!target) throw new Error('ANDROID_WEBVIEW_PAGE_NOT_FOUND');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let commandId = 0;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ANDROID_WEBVIEW_CDP_CONNECT_TIMEOUT')), 15_000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ANDROID_WEBVIEW_CDP_CONNECT_FAILED')); }, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  function command(method, params = {}) {
    const id = ++commandId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  await command('Runtime.enable');
  if (requestedRoute) {
    const routeResult = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `new URL(${JSON.stringify(requestedRoute)}, location.origin).href`,
    });
    await command('Page.enable');
    await command('Page.navigate', { url: routeResult.result.value });
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  const result = await command('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const token = sessionStorage.getItem('agm.auth.accessToken');
      const headers = token ? { Authorization: 'Bearer ' + token, Accept: 'application/json' } : { Accept: 'application/json' };
      const apiBase = 'https://api.agmcockpit.com/api/v1';
      const healthResponse = await fetch(apiBase + '/operations/components/android/health', { headers, cache: 'no-store' });
      const healthPayload = await healthResponse.json().catch(() => ({}));
      const eventsResponse = await fetch(apiBase + '/agent-runtime-events?limit=500', { headers, cache: 'no-store' });
      const eventsPayload = await eventsResponse.json().catch(() => ({}));
      const events = Array.isArray(eventsPayload?.data?.events) ? eventsPayload.data.events : [];
      const latestByAgent = {};
      for (const event of events) latestByAgent[event.agentId] = {
        agentId: event.agentId,
        mandateId: event.mandateId,
        lifecycle: event.lifecycle,
        occurredAt: event.occurredAt,
        recordedAt: event.recordedAt,
        detail: event.detail,
        evidenceRef: event.evidenceRef,
      };
      const rows = [...document.querySelectorAll('[data-agent-row-id], [data-live-agent-id]')]
        .map((row) => ({
          agentId: row.getAttribute('data-agent-row-id') || row.getAttribute('data-live-agent-id'),
          lifecycle: row.getAttribute('data-runtime-lifecycle'),
          className: row.className,
          text: row.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 600),
        }))
        .filter((row, index, all) => row.agentId && all.findIndex((candidate) => candidate.agentId === row.agentId) === index);
      const operationCards = [...document.querySelectorAll('[data-operation-id]')]
        .map((card) => ({
          id: card.getAttribute('data-operation-id'),
          className: card.className,
          text: card.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 800),
        }));
      const panel = document.querySelector('#turn-agent-panel iframe');
      const panelText = panel?.contentDocument?.body?.innerText?.replace(/\\s+/g, ' ').trim().slice(0, 5000) ?? null;
      const rowById = (id) => document.querySelector('[data-agent-row-id="' + id + '"]');
      const linguistic = ['agent-linguistic-ro-de', 'agent-linguistic-ro-en', 'agent-linguistic-de-en']
        .map((id) => rowById(id));
      const inspector = rowById('agent-inspector');
      const realBoard = document.querySelector('.turn-real-status-board');
      const androidCardText = document.querySelector('[data-operation-id="android"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const uiChecks = location.pathname !== '/turn' ? null : {
        linguisticActive: linguistic.every((row) => row?.textContent?.trim().toLowerCase().endsWith('active')),
        inspectorRegistryActive: inspector?.querySelector('.turn-status')?.textContent?.trim().toLowerCase() === 'active' && !inspector?.className.includes('failed'),
        inspectorLastRunSeparated: inspector?.getAttribute('data-last-runtime-lifecycle') === 'FAILED' && Boolean(inspector?.getAttribute('data-last-runtime-mandate')),
        androidLive: /AndroidONLINE/.test(androidCardText) && /Data freshnessLIVE/.test(androidCardText) && /Incident status[^A-Z]*NONE/.test(androidCardText),
        chiefSeparatedFromMon010: (document.querySelector('#turn-independent-monitor-title')?.textContent ?? '').includes('CHIEF-MONITORING-INSPECTOR') && !(document.querySelector('#turn-independent-monitor-title')?.textContent ?? '').includes('MON-010'),
        noDecorativeOperationalNodes: !['Orion', 'Nexa', 'GeminII'].some((name) => realBoard?.textContent?.includes(name)) && (realBoard?.querySelectorAll('.turn-status-row.planned[data-live-agent-id]').length ?? 0) === 0,
        staleInspectorArchive: document.body.textContent?.includes('SNAPSHOT ISTORIC / STALE') ?? false,
      };
      return {
        page: { title: document.title, route: location.pathname, visibilityState: document.visibilityState },
        bodyPreview: document.body?.innerText?.replace(/\\s+/g, ' ').trim().slice(0, 1200) ?? null,
        webRuntime: {
          scripts: [...document.scripts].map((script) => script.src).filter(Boolean),
          serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
          serviceWorkerControllerUrl: navigator.serviceWorker?.controller?.scriptURL ?? null,
        },
        authenticated: Boolean(token),
        healthHttpStatus: healthResponse.status,
        health: healthPayload?.data ?? null,
        eventsHttpStatus: eventsResponse.status,
        eventCount: events.length,
        latestByAgent,
        rows,
        operationCards,
        panelText,
        uiChecks,
      };
    })()`,
  });
  Object.assign(report, result.result.value);
  const uiPass = !report.uiChecks || Object.values(report.uiChecks).every(Boolean);
  report.status = report.healthHttpStatus === 200 && report.eventsHttpStatus === 200 && uiPass ? 'PASS' : 'FAIL';
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  socket?.close();
}

const serializedReport = JSON.stringify(report, null, 2);
if (outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${serializedReport}\n`, 'utf8');
}
console.log(serializedReport);
if (report.status !== 'PASS') process.exitCode = 1;
