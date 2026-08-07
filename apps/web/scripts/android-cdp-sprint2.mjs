const endpoint = 'http://127.0.0.1:9222/json';
const action = process.argv[2] ?? 'inspect';

const pages = await (await fetch(endpoint)).json();
const page = pages.find((candidate) => candidate.type === 'page' && !candidate.url.includes('/sw.js'));
if (!page) throw new Error('AGM Android WebView page not found.');

const expressions = {
  inspect: `JSON.stringify({
    url: location.href,
    scripts: [...document.scripts].map((item) => item.src),
    homeActions: document.querySelector('.home-actions')?.innerText ?? '',
    actions: [...document.querySelectorAll('[data-basic-action]')].map((item) => ({
      action: item.getAttribute('data-basic-action'),
      text: item.textContent.trim()
    }))
  })`,
  open: `(() => {
    const button = document.querySelector('[data-basic-action="tachograph-analysis"]');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-button' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  confirm: `(() => {
    const textarea = document.querySelector('#ocrExtractedText');
    const confirmation = document.querySelector('#confirmTachographText');
    if (!textarea || !confirmation) return JSON.stringify({ ok: false, reason: 'missing-confirmation-controls' });
    textarea.value = 'CARD ERROR 50. Pauză necesară 00h45. Introducere țară DE.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    confirmation.click();
    return JSON.stringify({ ok: true });
  })()`,
  analyze: `(() => {
    const button = document.querySelector('#analyzeTachograph');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-analyze-button' });
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
    text: document.querySelector('#ocrExtractedText')?.value ?? '',
    confirmation: document.querySelector('#confirmTachographText')?.textContent?.trim() ?? '',
    analyzeDisabled: document.querySelector('#analyzeTachograph')?.disabled ?? null,
    status: document.querySelector('[role="status"]')?.textContent?.trim() ?? '',
    title: document.querySelector('#tachograph-analysis-title')?.textContent?.trim() ?? '',
    result: document.querySelector('.tachograph-analysis')?.innerText?.trim() ?? '',
    translator: Boolean(document.querySelector('#tachographAnalysisToTranslator')),
    email: Boolean(document.querySelector('#tachographAnalysisToEmail')),
    retry: Boolean(document.querySelector('#tachographAnalysisRetry'))
  })`
};

const expression = expressions[action];
if (!expression) throw new Error(`Unknown action: ${action}`);

const socket = new WebSocket(page.webSocketDebuggerUrl);
const result = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('CDP response timeout.')), 10_000);
  socket.onopen = () => socket.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression, returnByValue: true, awaitPromise: true }
  }));
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
