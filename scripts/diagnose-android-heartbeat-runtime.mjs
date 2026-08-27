const endpoint = process.env.AGM_ANDROID_CDP ?? 'http://127.0.0.1:9223';
const connectTimeoutMs = Number(process.env.AGM_ANDROID_CDP_TIMEOUT_MS ?? 15_000);
const observationMs = Number(process.env.AGM_ANDROID_HEARTBEAT_OBSERVATION_MS ?? 35_000);
const report = { checkedAt: new Date().toISOString(), endpoint, transport: 'direct-page-cdp', status: 'FAIL', heartbeatResponses: [], preflights: [], apiActivity: [], networkFailures: [], consoleErrors: [] };
let socket;

try {
  const targets = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(connectTimeoutMs) }).then((response) => response.json());
  const target = targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
  if (!target) throw new Error('ANDROID_WEBVIEW_PAGE_NOT_FOUND');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  const pendingCommands = new Map();
  const requests = new Map();
  const pendingBodies = [];
  let commandId = 0;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const pending = pendingCommands.get(message.id);
      if (!pending) return;
      pendingCommands.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    if (message.method === 'Network.requestWillBeSent') {
      const requestUrl = new URL(message.params.request.url);
      requests.set(message.params.requestId, {
        method: message.params.request.method,
        url: message.params.request.url,
        origin: message.params.request.headers?.Origin ?? message.params.request.headers?.origin ?? null,
        requestedHeaders: message.params.request.headers?.['Access-Control-Request-Headers'] ?? message.params.request.headers?.['access-control-request-headers'] ?? null,
      });
      if (requestUrl.pathname.includes('/api/v1/')) report.apiActivity.push({ phase: 'request', method: message.params.request.method, path: requestUrl.pathname });
      return;
    }
    if (message.method === 'Network.responseReceived') {
      const url = new URL(message.params.response.url);
      if (url.pathname.includes('/api/v1/')) report.apiActivity.push({ phase: 'response', method: requests.get(message.params.requestId)?.method ?? null, path: url.pathname, httpStatus: message.params.response.status });
      if (!url.pathname.endsWith('/api/v1/operations/components/android/heartbeat')) return;
      const request = requests.get(message.params.requestId) ?? {};
      if (request.method === 'OPTIONS') {
        const headers = message.params.response.headers ?? {};
        report.preflights.push({
          method: 'OPTIONS',
          path: url.pathname,
          httpStatus: message.params.response.status,
          origin: request.origin ?? null,
          requestedHeaders: request.requestedHeaders ?? null,
          allowOrigin: headers['access-control-allow-origin'] ?? null,
          allowHeaders: headers['access-control-allow-headers'] ?? null,
          allowMethods: headers['access-control-allow-methods'] ?? null,
        });
        return;
      }
      const base = {
        method: request.method ?? null,
        path: url.pathname,
        httpStatus: message.params.response.status,
      };
      pendingBodies.push(new Promise((resolve) => setTimeout(resolve, 250)).then(() => command('Network.getResponseBody', { requestId: message.params.requestId })).then(({ body }) => {
        const payload = JSON.parse(body);
        report.heartbeatResponses.push({
          ...base,
          status: payload?.data?.status ?? null,
          freshness: payload?.data?.freshness ?? null,
          reason: payload?.data?.reason ?? null,
          lastSeenAt: payload?.data?.lastSeenAt ?? null,
        });
      }).catch(() => report.heartbeatResponses.push({ ...base, parse: 'FAILED' })));
      return;
    }
    if (message.method === 'Network.loadingFailed') {
      const request = requests.get(message.params.requestId);
      if (!request?.url?.endsWith('/api/v1/operations/components/android/heartbeat')) return;
      report.networkFailures.push({ method: request.method, path: new URL(request.url).pathname, errorText: message.params.errorText, blockedReason: message.params.blockedReason ?? null, corsErrorStatus: message.params.corsErrorStatus ?? null });
      return;
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      const text = message.params.args.map((argument) => argument.value ?? argument.description ?? '').join(' ');
      report.consoleErrors.push(text.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 500));
    }
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ANDROID_WEBVIEW_CDP_CONNECT_TIMEOUT')), connectTimeoutMs);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ANDROID_WEBVIEW_CDP_CONNECT_FAILED')); }, { once: true });
  });

  function command(method, params = {}) {
    const id = ++commandId;
    return new Promise((resolve, reject) => {
      pendingCommands.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  await command('Network.enable');
  await command('Runtime.enable');
  await command('Page.bringToFront');
  await new Promise((resolve) => setTimeout(resolve, observationMs));
  await Promise.allSettled(pendingBodies);
  const runtime = await command('Runtime.evaluate', {
    expression: '({ title: document.title, route: location.pathname })',
    returnByValue: true,
  });
  report.page = runtime.result.value;
  report.status = report.heartbeatResponses.some((item) => item.httpStatus === 201 && item.status === 'ONLINE' && item.freshness === 'LIVE') ? 'PASS' : 'FAIL';
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  socket?.close();
}

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
