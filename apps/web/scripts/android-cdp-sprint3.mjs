const endpoint = 'http://127.0.0.1:9222/json';
const action = process.argv[2] ?? 'inspect';
const pages = await (await fetch(endpoint)).json();
const page = pages.find((candidate) => candidate.type === 'page' && !candidate.url.includes('/sw.js'));
if (!page) throw new Error('AGM Android WebView page not found.');

const expressions = {
  inspect: `JSON.stringify({
    url: location.href,
    script: [...document.scripts].map((item) => item.src).find((src) => src.includes('/assets/main-')) ?? '',
    actions: [...document.querySelectorAll('[data-basic-action]')].map((item) => item.getAttribute('data-basic-action'))
  })`,
  open: `(() => {
    const button = document.querySelector('[data-basic-action="dashboard-text-analysis"]');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-button' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  confirm: `(() => {
    const textarea = document.querySelector('#ocrExtractedText');
    if (!textarea) return JSON.stringify({ ok: false, reason: 'missing-textarea' });
    textarea.value = 'Brake system fault. Error code EBS-42. Service.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const confirmation = document.querySelector('#confirmDashboardText');
    if (!confirmation || confirmation.disabled) return JSON.stringify({ ok: false, reason: 'confirmation-disabled' });
    confirmation.click();
    return JSON.stringify({ ok: true });
  })()`,
  analyze: `(() => {
    const button = document.querySelector('#analyzeDashboardText');
    if (!button || button.disabled) return JSON.stringify({ ok: false, reason: 'analysis-disabled' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  dismiss: `(() => {
    const control = document.querySelector('#acceptLegalNotice, #closeTutorial, #skipRoadmapInvitation');
    if (!control) return JSON.stringify({ ok: true, dismissed: 'none' });
    const dismissed = control.id;
    control.click();
    return JSON.stringify({ ok: true, dismissed });
  })()`,
  result: `JSON.stringify({
    url: location.href,
    textConfirmed: document.querySelector('#confirmDashboardText')?.textContent?.trim() ?? '',
    title: document.querySelector('#dashboard-text-analysis-title')?.textContent?.trim() ?? '',
    result: document.querySelector('.dashboard-text-analysis')?.innerText?.trim() ?? '',
    translator: Boolean(document.querySelector('#dashboardTextAnalysisToTranslator')),
    email: Boolean(document.querySelector('#dashboardTextAnalysisToEmail')),
    retry: Boolean(document.querySelector('#dashboardTextAnalysisRetry'))
  })`
};

const expression = expressions[action];
if (!expression) throw new Error(`Unknown action: ${action}`);
const socket = new WebSocket(page.webSocketDebuggerUrl);
const result = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('CDP response timeout.')), 10_000);
  socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  socket.onerror = () => reject(new Error('CDP connection failed.'));
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== 1) return;
    clearTimeout(timeout);
    socket.close();
    if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text));
    else resolve(message.result?.result?.value);
  };
});

console.log(result);
