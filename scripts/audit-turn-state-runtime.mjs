const endpoint = process.env.AGM_ANDROID_CDP ?? 'http://127.0.0.1:9223';
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
      return {
        page: { title: document.title, route: location.pathname, visibilityState: document.visibilityState },
        authenticated: Boolean(token),
        healthHttpStatus: healthResponse.status,
        health: healthPayload?.data ?? null,
        eventsHttpStatus: eventsResponse.status,
        eventCount: events.length,
        latestByAgent,
        rows,
        operationCards,
        panelText,
      };
    })()`,
  });
  Object.assign(report, result.result.value);
  report.status = report.healthHttpStatus === 200 && report.eventsHttpStatus === 200 ? 'PASS' : 'FAIL';
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  socket?.close();
}

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
