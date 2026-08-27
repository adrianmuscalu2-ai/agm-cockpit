const endpoint = process.env.AGM_ANDROID_CDP ?? 'http://127.0.0.1:9223';
const connectTimeoutMs = Number(process.env.AGM_ANDROID_CDP_TIMEOUT_MS ?? 10_000);
const report = { checkedAt: new Date().toISOString(), endpoint, transport: 'direct-page-cdp', route: '/premium -> /turn', status: 'FAIL' };
let socket;

try {
  const targets = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(connectTimeoutMs) }).then((response) => response.json());
  const target = targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
  if (!target) throw new Error('ANDROID_WEBVIEW_PAGE_NOT_FOUND');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const command = pending.get(message.id);
    if (!command) return;
    pending.delete(message.id);
    if (message.error) command.reject(new Error(message.error.message));
    else command.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ANDROID_WEBVIEW_CDP_CONNECT_TIMEOUT')), connectTimeoutMs);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ANDROID_WEBVIEW_CDP_CONNECT_FAILED')); }, { once: true });
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const commandId = ++id;
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'ANDROID_RUNTIME_EVALUATION_FAILED');
    return result.result.value;
  };

  await command('Runtime.enable');
  await command('Page.bringToFront');
  await evaluate(`(() => { history.pushState({}, '', '/premium'); dispatchEvent(new PopStateEvent('popstate')); return true; })()`);
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  report.premium = await evaluate(`(() => ({
    heading: document.querySelector('#premium-dashboard-title')?.textContent?.trim() ?? '',
    authorityDashboardCount: document.querySelectorAll('[data-authority-dashboard]').length,
    agentNetworkCount: document.querySelectorAll('[data-agent-network-detail]').length,
    legacyNetworkLinkCount: document.querySelectorAll('a[href="/premium/network"]').length,
    workspaceCount: document.querySelectorAll('.premium-user-workspace').length
  }))()`);

  await evaluate(`(() => { history.pushState({}, '', '/turn'); dispatchEvent(new PopStateEvent('popstate')); return true; })()`);
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  report.turn = await evaluate(`(() => ({
    protectedByPin: document.querySelectorAll('#adminLoginForm').length === 1,
    authorityVisibleWithoutUnlock: document.querySelectorAll('#turn-authority-control-plane').length > 0
  }))()`);
  report.status = report.premium.heading === 'Centru Premium'
    && report.premium.authorityDashboardCount === 0
    && report.premium.agentNetworkCount === 0
    && report.premium.legacyNetworkLinkCount === 0
    && report.premium.workspaceCount === 4
    && report.turn.protectedByPin
    && !report.turn.authorityVisibleWithoutUnlock
    ? 'PASS'
    : 'FAIL';
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  socket?.close();
}

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
