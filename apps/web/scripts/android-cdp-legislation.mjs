const endpoint = 'http://127.0.0.1:9222/json';
const action = process.argv[2] ?? 'inspect';
const pages = await (await fetch(endpoint)).json();
const page = pages.find((candidate) => candidate.type === 'page' && !candidate.url.includes('/sw.js'));
if (!page) throw new Error('AGM Android WebView page not found.');

if (action === 'uploadCmr') {
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();
  const consoleMessages = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('CDP connection failed.'));
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled') {
        consoleMessages.push(message.params?.args?.map((item) => item.description ?? item.value ?? '').join(' '));
        return;
      }
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    };
  });
  await send('Runtime.enable');
  const evaluated = await send('Runtime.evaluate', { expression: `document.querySelector('#ocrFileInput')`, returnByValue: false });
  const objectId = evaluated.result?.objectId;
  if (!objectId) throw new Error('OCR file input not found.');
  const described = await send('DOM.describeNode', { objectId });
  await send('DOM.setFileInputFiles', { backendNodeId: described.node?.backendNodeId, files: ['/sdcard/Download/CMR_yuk_xati.jpg'] });
  const fileMetadata = await send('Runtime.evaluate', { expression: `(() => { const file = document.querySelector('#ocrFileInput')?.files?.[0]; return JSON.stringify(file ? { name: file.name, size: file.size, type: file.type } : null); })()`, returnByValue: true });
  await new Promise((resolve) => setTimeout(resolve, 35_000));
  const state = await send('Runtime.evaluate', { expression: `JSON.stringify({ busy: document.querySelector('.ocr-page')?.getAttribute('aria-busy') ?? 'false', text: document.querySelector('#ocrExtractedText')?.value ?? '', status: document.querySelector('footer.status')?.innerText?.trim() ?? '' })`, returnByValue: true });
  socket.close();
  console.log(JSON.stringify({ ok: true, file: '/sdcard/Download/CMR_yuk_xati.jpg', fileMetadata: JSON.parse(fileMetadata.result?.value ?? 'null'), state: JSON.parse(state.result?.value ?? '{}'), consoleMessages }, null, 2));
  process.exit(0);
}

const expressions = {
  navigate: `(() => { location.href = 'https://localhost/basic'; return JSON.stringify({ ok: true }); })()`,
  inspect: `JSON.stringify({
    url: location.href,
    actions: [...document.querySelectorAll('[data-basic-action]')].map((item) => item.getAttribute('data-basic-action'))
  })`,
  ocrInspect: `JSON.stringify({
    url: location.href,
    busy: document.querySelector('.ocr-page')?.getAttribute('aria-busy') ?? 'false',
    text: document.querySelector('#ocrExtractedText')?.value ?? '',
    status: document.querySelector('footer.status')?.innerText?.trim() ?? ''
  })`,
  open: `(() => {
    const button = document.querySelector('[data-basic-action="legislation-analysis"]');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-button' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  transportOpen: `(() => {
    const button = document.querySelector('[data-basic-action="transport-document"]');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-button' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  tachographOpen: `(() => {
    const button = document.querySelector('[data-basic-action="tachograph-analysis"]');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-button' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  tachographConfirmExisting: `(() => {
    const textarea = document.querySelector('#ocrExtractedText');
    const confirmation = document.querySelector('#confirmTachographText');
    if (!textarea?.value?.trim()) return JSON.stringify({ ok: false, reason: 'missing-text' });
    if (!confirmation || confirmation.disabled) return JSON.stringify({ ok: false, reason: 'confirmation-disabled' });
    confirmation.click();
    return JSON.stringify({ ok: true, textLength: textarea.value.length });
  })()`,
  tachographAnalyze: `(() => {
    const button = document.querySelector('#analyzeTachograph');
    if (!button || button.disabled) return JSON.stringify({ ok: false, reason: 'analysis-disabled' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  tachographResult: `JSON.stringify({
    url: location.href,
    textConfirmed: document.querySelector('#confirmTachographText')?.textContent?.trim() ?? '',
    title: document.querySelector('#tachograph-analysis-title')?.textContent?.trim() ?? '',
    result: document.querySelector('.tachograph-analysis')?.innerText?.trim() ?? '',
    translator: Boolean(document.querySelector('#tachographAnalysisToTranslator')),
    email: Boolean(document.querySelector('#tachographAnalysisToEmail')),
    retry: Boolean(document.querySelector('#tachographAnalysisRetry'))
  })`,
  dashboardResult: `JSON.stringify({
    url: location.href,
    textConfirmed: document.querySelector('#confirmDashboardText')?.textContent?.trim() ?? '',
    title: document.querySelector('#dashboard-text-analysis-title')?.textContent?.trim() ?? '',
    result: document.querySelector('.dashboard-text-analysis')?.innerText?.trim() ?? '',
    translator: Boolean(document.querySelector('#dashboardTextAnalysisToTranslator')),
    email: Boolean(document.querySelector('#dashboardTextAnalysisToEmail')),
    retry: Boolean(document.querySelector('#dashboardTextAnalysisRetry'))
  })`,
  transportConfirmExisting: `(() => {
    const textarea = document.querySelector('#ocrExtractedText');
    const confirmation = document.querySelector('#confirmTransportDocumentText');
    if (!textarea?.value?.trim()) return JSON.stringify({ ok: false, reason: 'missing-text' });
    if (!confirmation || confirmation.disabled) return JSON.stringify({ ok: false, reason: 'confirmation-disabled' });
    confirmation.click();
    return JSON.stringify({ ok: true, textLength: textarea.value.length });
  })()`,
  transportConfirmCmrRegression: `(() => {
    const textarea = document.querySelector('#ocrExtractedText');
    if (!textarea) return JSON.stringify({ ok: false, reason: 'missing-textarea' });
    textarea.value = 'Xalqaro\\ntovar va transport CMR)\\nyuk xati\\nBelgilar va raqamiar\\ni 10 SEE';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const confirmation = document.querySelector('#confirmTransportDocumentText');
    if (!confirmation || confirmation.disabled) return JSON.stringify({ ok: false, reason: 'confirmation-disabled' });
    confirmation.click();
    return JSON.stringify({ ok: true });
  })()`,
  transportAnalyze: `(() => {
    const button = document.querySelector('#analyzeTransportDocument');
    if (!button || button.disabled) return JSON.stringify({ ok: false, reason: 'analysis-disabled' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  transportResult: `JSON.stringify({
    url: location.href,
    textConfirmed: document.querySelector('#confirmTransportDocumentText')?.textContent?.trim() ?? '',
    title: document.querySelector('#transport-analysis-title')?.textContent?.trim() ?? '',
    result: document.querySelector('.transport-document-analysis')?.innerText?.trim() ?? '',
    translator: Boolean(document.querySelector('#transportAnalysisToTranslator')),
    email: Boolean(document.querySelector('#transportAnalysisToEmail')),
    retry: Boolean(document.querySelector('#transportAnalysisRetry'))
  })`,
  confirm: `(() => {
    const textarea = document.querySelector('#ocrExtractedText');
    if (!textarea) return JSON.stringify({ ok: false, reason: 'missing-textarea' });
    textarea.value = 'Art. 7: După 4 h 30 min de conducere, pauză de 45 minute.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const confirmation = document.querySelector('#confirmLegislationText');
    if (!confirmation || confirmation.disabled) return JSON.stringify({ ok: false, reason: 'confirmation-disabled' });
    confirmation.click();
    return JSON.stringify({ ok: true });
  })()`,
  analyze: `(() => {
    const button = document.querySelector('#analyzeLegislation');
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
    textConfirmed: document.querySelector('#confirmLegislationText')?.textContent?.trim() ?? '',
    title: document.querySelector('#legislation-analysis-title')?.textContent?.trim() ?? '',
    result: document.querySelector('.legislation-analysis')?.innerText?.trim() ?? '',
    translator: Boolean(document.querySelector('#legislationAnalysisToTranslator')),
    email: Boolean(document.querySelector('#legislationAnalysisToEmail')),
    retry: Boolean(document.querySelector('#legislationAnalysisRetry'))
  })`,
  cargoOpen: `(() => {
    const button = document.querySelector('[data-basic-action="cargo-safety-analysis"]');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-button' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  cargoConfirm: `(() => {
    const textarea = document.querySelector('#ocrExtractedText');
    if (!textarea) return JSON.stringify({ ok: false, reason: 'missing-textarea' });
    textarea.value = 'EN 12195-2 LC 2500 daN STF 350 daN. Etichetă chingă.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const confirmation = document.querySelector('#confirmCargoSafetyText');
    if (!confirmation || confirmation.disabled) return JSON.stringify({ ok: false, reason: 'confirmation-disabled' });
    confirmation.click();
    return JSON.stringify({ ok: true });
  })()`,
  cargoAnalyze: `(() => {
    const button = document.querySelector('#analyzeCargoSafety');
    if (!button || button.disabled) return JSON.stringify({ ok: false, reason: 'analysis-disabled' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  cargoResult: `JSON.stringify({
    url: location.href,
    textConfirmed: document.querySelector('#confirmCargoSafetyText')?.textContent?.trim() ?? '',
    title: document.querySelector('#cargo-safety-analysis-title')?.textContent?.trim() ?? '',
    result: document.querySelector('.cargo-safety-analysis')?.innerText?.trim() ?? '',
    translator: Boolean(document.querySelector('#cargoSafetyAnalysisToTranslator')),
    email: Boolean(document.querySelector('#cargoSafetyAnalysisToEmail')),
    retry: Boolean(document.querySelector('#cargoSafetyAnalysisRetry'))
  })`,
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
