const endpoint = 'http://127.0.0.1:9222/json';
const action = process.argv[2] ?? 'inspect';
const requestedLanguage = process.argv[3] ?? 'fr';
const requestedText = process.argv[4] ?? 'The vehicle is ready for pickup tomorrow at 09:00.';
const pages = await (await fetch(endpoint)).json();
const page = pages.find((candidate) => candidate.type === 'page' && !candidate.url.includes('/sw.js'));
if (!page) throw new Error('AGM Android WebView page not found.');

const expressions = {
  wave1: `JSON.stringify({
    url: location.href,
    language: document.documentElement.lang,
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    quickLanguages: [...document.querySelectorAll('[data-quick-language]')].map((item) => item.textContent.trim()),
    moreLanguages: [...document.querySelectorAll('[data-more-language] option')].map((item) => item.textContent.trim())
  })`,
  'wave1-links': `JSON.stringify([...document.querySelectorAll('a, button')].map((item) => ({
    text: item.textContent.trim().replace(/\\s+/g, ' '),
    href: item.getAttribute('href'),
    action: item.getAttribute('data-basic-action')
  })).filter((item) => /email|ocr|translator|перев|почт/i.test(item.text) || item.action === 'ocr'))`,
  'wave1-open-email': `(() => { document.querySelector('a[href="/email"]')?.click(); return location.href; })()`,
  'wave1-email': `JSON.stringify({ url: location.href, language: document.documentElement.lang,
    targetLanguages: [...document.querySelectorAll('select option')].map((item) => item.textContent.trim()).filter((text) => /Français|Nederlands|Русский|Polski|Türkçe|Shqip/.test(text)),
    hasComposer: Boolean(document.querySelector('textarea, [contenteditable="true"]')) })`,
  'wave1-open-ocr': `(() => { history.pushState({}, '', '/basic'); dispatchEvent(new PopStateEvent('popstate')); setTimeout(() => document.querySelector('[data-basic-action="ocr"]')?.click(), 100); return true; })()`,
  'wave1-ocr': `JSON.stringify({ url: location.href, language: document.documentElement.lang,
    languages: [...document.querySelectorAll('select option')].map((item) => item.textContent.trim()).filter((text) => /Français|Nederlands|Русский|Polski|Türkçe|Shqip/.test(text)),
    hasFileInput: Boolean(document.querySelector('input[type="file"]')) })`,
  'translator-open': `(() => { history.pushState({}, '', '/translator'); dispatchEvent(new PopStateEvent('popstate')); return location.href; })()`,
  'translator-state': `JSON.stringify({
    url: location.href,
    source: document.querySelector('#translatorText')?.value ?? '',
    target: document.querySelector('[data-active-language]')?.getAttribute('data-active-language') ?? '',
    selectedMore: document.querySelector('[data-language-more="translatorTargetLanguage"]')?.value ?? '',
    moreOptions: [...(document.querySelector('[data-language-more="translatorTargetLanguage"]')?.options ?? [])].map((option) => option.value),
    result: document.querySelector('.cockpit-result p')?.innerText?.trim() ?? '',
    status: document.querySelector('footer.status[role="status"] > span')?.textContent?.trim() ?? ''
  })`,
  'translator-select': `(() => {
    const button = document.querySelector('[data-language-group="translatorTargetLanguage"][data-language=${JSON.stringify(requestedLanguage)}]');
    if (button) {
      button.click();
      return JSON.stringify({ ok: true, mechanism: 'quick-button', requested: ${JSON.stringify(requestedLanguage)} });
    }
    const select = document.querySelector('[data-language-more="translatorTargetLanguage"]');
    if (!select) return JSON.stringify({ ok: false, reason: 'missing-select' });
    select.value = ${JSON.stringify(requestedLanguage)}; select.dispatchEvent(new Event('change', { bubbles: true }));
    return JSON.stringify({ ok: true, mechanism: 'more-select', requested: ${JSON.stringify(requestedLanguage)} });
  })()`,
  'translator-prepare': `(() => {
    const textarea = document.querySelector('#translatorText');
    if (!textarea) return JSON.stringify({ ok: false, reason: 'missing-input' });
    textarea.value = ${JSON.stringify(requestedText)};
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return JSON.stringify({ ok: true, source: textarea.value });
  })()`,
  'translator-translate': `(() => {
    const button = document.querySelector('#translateText, [data-command="translator-translate"]');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-translate-command' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  'translator-result-view': `(() => {
    const result = document.querySelector('.cockpit-result');
    if (!result) return JSON.stringify({ ok: false, reason: 'missing-result' });
    result.scrollIntoView({ block: 'center' });
    return JSON.stringify({ ok: true, result: result.innerText.trim() });
  })()`,
  'translator-api-probe': `(async () => {
    try {
      const response = await fetch('https://api.agmcockpit.com/api/v1/translation/actions/translate-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ${JSON.stringify(requestedText)}, sourceLanguage: 'en', targetLanguage: ${JSON.stringify(requestedLanguage)} })
      });
      return JSON.stringify({ ok: response.ok, status: response.status, payload: await response.json() });
    } catch (error) {
      return JSON.stringify({ ok: false, error: String(error) });
    }
  })()`,
  'email-open': `(() => { history.pushState({}, '', '/email'); dispatchEvent(new PopStateEvent('popstate')); return location.href; })()`,
  'email-state': `JSON.stringify({
    url: location.href,
    message: document.querySelector('#message')?.value ?? '',
    target: document.querySelector('[data-active-language]')?.getAttribute('data-active-language') ?? '',
    translatorEnabled: document.querySelector('#translatorEnabled')?.checked ?? false,
    status: document.querySelector('footer.status[role="status"] > span')?.textContent?.trim() ?? ''
  })`,
  'email-select': `(() => {
    const button = document.querySelector('[data-language-group="targetLanguage"][data-language=${JSON.stringify(requestedLanguage)}]');
    if (button) { button.click(); return JSON.stringify({ ok: true, mechanism: 'quick-button' }); }
    const select = document.querySelector('[data-language-more="targetLanguage"]');
    if (!select) return JSON.stringify({ ok: false, reason: 'missing-select' });
    select.value = ${JSON.stringify(requestedLanguage)}; select.dispatchEvent(new Event('change', { bubbles: true }));
    return JSON.stringify({ ok: true, mechanism: 'more-select' });
  })()`,
  'email-prepare': `(() => {
    const message = document.querySelector('#message');
    if (!message) return JSON.stringify({ ok: false, reason: 'missing-message' });
    message.value = ${JSON.stringify(requestedText)};
    message.dispatchEvent(new Event('input', { bubbles: true }));
    return JSON.stringify({ ok: true });
  })()`,
  'email-translate': `(() => {
    const button = document.querySelector('[data-command="email-translate"]');
    if (!button) return JSON.stringify({ ok: false, reason: 'missing-email-translate' });
    button.click(); return JSON.stringify({ ok: true });
  })()`,
  'slice-a-open': `(() => { location.href='/before-departure.html'; return location.href; })()`,
  'premium-open': `(() => { document.querySelector('[data-module="premium"]')?.click(); return location.href; })()`,
  'access-open-premium': `(() => { const link=document.querySelector('[data-access-premium-link]'); if(!link)return JSON.stringify({ok:false}); link.click(); return JSON.stringify({ok:true,href:link.getAttribute('href')}); })()`,
  'premium-before-open': `(() => { const link=document.querySelector('a[href="/before-departure.html"]'); if(!link)return JSON.stringify({ok:false,links:[...document.querySelectorAll('a')].map(item=>item.getAttribute('href'))}); link.click(); return JSON.stringify({ok:true}); })()`,
  'slice-a-inspect': `JSON.stringify({
    url: location.href,
    language: document.documentElement.lang,
    title: document.title,
    text: document.body.innerText,
    selects: [...document.querySelectorAll('select')].map((item) => ({ value: item.value, options: [...item.options].map((option) => ({ value: option.value, text: option.textContent?.trim() })) })),
    buttons: [...document.querySelectorAll('button')].map((item) => ({ text: item.textContent?.trim(), disabled: item.disabled, data: { ...item.dataset } })),
    inputs: [...document.querySelectorAll('input, textarea')].map((item) => ({ type: item.type, value: item.value, checked: item.checked, data: { ...item.dataset } }))
  })`,
  'slice-a-checkpoint': `(() => {
    const value=JSON.parse(localStorage.getItem('agm.premium.operational-case.v1')??'null');
    return JSON.stringify({url:location.href,state:value?.state,revision:value?.revision,documentType:value?.data?.documentType,available:value?.data?.available,hasOriginal:value?.evidence?.some(item=>item.kind==='original')??false,hasOcr:value?.evidence?.some(item=>item.kind==='ocr-proposal')??false,textConfirmed:value?.data?.textConfirmed??false,readable:value?.data?.readable??null,recoveryReason:value?.data?.recoveryReason??null,renderedStatus:[...document.querySelectorAll('[role="status"]')].map(item=>item.textContent?.trim())});
  })()`,
  'slice-a-select-document': `(() => { const select=[...document.querySelectorAll('select')].find(item => [...item.options].some(option => option.value === 'cmr')); if(!select)return JSON.stringify({ok:false}); select.value='cmr'; select.dispatchEvent(new Event('change',{bubbles:true})); return JSON.stringify({ok:true,value:select.value}); })()`,
  'slice-a-missing': `(() => { const button=document.querySelector('[data-available="false"]'); if(!button)return JSON.stringify({ok:false}); button.click(); return JSON.stringify({ok:true}); })()`,
  'slice-a-available': `(() => { const button=document.querySelector('[data-available="true"]'); if(!button)return JSON.stringify({ok:false}); button.click(); return JSON.stringify({ok:true}); })()`,
  'slice-a-import-test-image': `(async () => { const input=document.querySelector('input[data-source="import"]'); if(!input)return JSON.stringify({ok:false,reason:'missing-input'}); const response=await fetch('/images/images/logo1.png'); if(!response.ok)return JSON.stringify({ok:false,reason:'fixture-http-'+response.status}); const file=new File([await response.blob()],'agm-official-logo.png',{type:'image/png'}); const transfer=new DataTransfer(); transfer.items.add(file); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(resolve=>setTimeout(resolve,1500)); return JSON.stringify({ok:true,name:file.name,size:file.size}); })()`,
  'slice-a-run-ocr': `(() => { const button=document.querySelector('[data-ocr]'); if(!button)return JSON.stringify({ok:false}); button.click(); return JSON.stringify({ok:true}); })()`,
  'slice-a-confirm-ocr': `(() => { const text=document.querySelector('textarea[data-ocr-text]'); const confirmer=document.querySelector('[data-confirmer]'); const confirmation=document.querySelector('[data-confirm]'); if(!text||!confirmer||!confirmation)return JSON.stringify({ok:false}); text.value=text.value+'\\n[verificat]'; text.dispatchEvent(new Event('input',{bubbles:true})); confirmer.value='android-field-validator'; confirmer.dispatchEvent(new Event('input',{bubbles:true})); confirmation.checked=true; confirmation.dispatchEvent(new Event('change',{bubbles:true})); return JSON.stringify({ok:true,edited:true,confirmed:true}); })()`,
  'slice-a-edit-ocr': `(() => { const text=document.querySelector('textarea[data-ocr-text]'); if(!text)return JSON.stringify({ok:false}); text.value=text.value.replace(/\\s*$/,'')+'\\n[verified-android]'; text.dispatchEvent(new Event('input',{bubbles:true})); return JSON.stringify({ok:true}); })()`,
  'slice-a-set-confirmer': `(() => { const input=document.querySelector('[data-confirmer]'); if(!input)return JSON.stringify({ok:false}); input.value='android-field-validator'; input.dispatchEvent(new Event('input',{bubbles:true})); return JSON.stringify({ok:true}); })()`,
  'slice-a-check-confirm': `(() => { const input=document.querySelector('[data-confirm]'); if(!input)return JSON.stringify({ok:false}); input.checked=true; input.dispatchEvent(new Event('change',{bubbles:true})); return JSON.stringify({ok:true}); })()`,
  'slice-a-readable': `(() => { const input=document.querySelector('[data-check="readable"]'); if(!input)return JSON.stringify({ok:false}); input.checked=true; input.dispatchEvent(new Event('change',{bubbles:true})); return JSON.stringify({ok:true}); })()`,
  'slice-a-unreadable-remediation': `(() => {
    const readable=document.querySelector('[data-check="readable"]');
    const severity=document.querySelector('[data-field="severity"]');
    const remediation=document.querySelector('[data-field="remediation"]');
    if(!readable||!severity||!remediation)return JSON.stringify({ok:false});
    readable.checked=false; readable.dispatchEvent(new Event('change',{bubbles:true}));
    severity.value='blocking'; severity.dispatchEvent(new Event('change',{bubbles:true}));
    remediation.value='Solicită o copie lizibilă și reverifică documentul.'; remediation.dispatchEvent(new Event('change',{bubbles:true}));
    return JSON.stringify({ok:true,readable:readable.checked,severity:severity.value});
  })()`,
  'slice-a-valid-until': `(() => { const input=document.querySelector('[data-field="validUntil"]'); if(!input)return JSON.stringify({ok:false}); input.value='2027-12-31'; input.dispatchEvent(new Event('change',{bubbles:true})); return JSON.stringify({ok:true,value:input.value}); })()`,
  'slice-a-ready': `(() => { const button=document.querySelector('[data-ready]'); if(!button)return JSON.stringify({ok:false}); const disabled=button.disabled; if(!disabled)button.click(); return JSON.stringify({ok:true,disabled}); })()`,
  'slice-a-language': `(() => { const select=[...document.querySelectorAll('select')].find(item => [...item.options].some(option => option.value === ${JSON.stringify(requestedLanguage)})); if(!select)return JSON.stringify({ok:false}); select.value=${JSON.stringify(requestedLanguage)}; select.dispatchEvent(new Event('change',{bubbles:true})); return JSON.stringify({ok:true,value:select.value}); })()`,
  'slice-a-rollback-off': `(() => { localStorage.setItem('agm.premium.situation-router.enabled','false'); location.reload(); return JSON.stringify({ok:true,enabled:false}); })()`,
  'slice-a-rollback-on': `(() => { localStorage.setItem('agm.premium.situation-router.enabled','true'); location.reload(); return JSON.stringify({ok:true,enabled:true}); })()`,
  'slice-a-validation-backup': `(() => {
    const keys=['agm.premium.operational-case.v1','agm.premium.trip-context.v1','agm.premium.operational-events.v1','agm.premium.operational-outbox.v1','agm.premium.operational-conflicts.v1','agm.premium.language'];
    const values=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
    localStorage.setItem('agm.validation.slice-a.backup.v1',JSON.stringify(values));
    return JSON.stringify({ok:true,keys:keys.filter(key=>values[key]!==null)});
  })()`,
  'slice-a-validation-reset': `(() => {
    ['agm.premium.operational-case.v1','agm.premium.trip-context.v1','agm.premium.operational-events.v1','agm.premium.operational-outbox.v1','agm.premium.operational-conflicts.v1'].forEach(key=>localStorage.removeItem(key));
    location.reload(); return JSON.stringify({ok:true});
  })()`,
  'slice-a-validation-restore': `(() => {
    const raw=localStorage.getItem('agm.validation.slice-a.backup.v1'); if(!raw)return JSON.stringify({ok:false,reason:'missing-backup'});
    const values=JSON.parse(raw); Object.entries(values).forEach(([key,value])=>value===null?localStorage.removeItem(key):localStorage.setItem(key,value));
    location.reload(); return JSON.stringify({ok:true});
  })()`,
  'slice-a-reload': `(() => { location.reload(); return JSON.stringify({ok:true}); })()`,
  'slice-b-safety': `(() => { localStorage.setItem('agm.premium.situation-router.enabled','true'); localStorage.removeItem('agm.premium.operational-case.v1:road-control'); location.reload(); return JSON.stringify({ok:true}); })()`,
  'slice-b-unsafe': `(() => { const button=document.querySelector('[data-safe="false"]'); if(!button)return JSON.stringify({ok:false,reason:'missing-unsafe'}); button.click(); return JSON.stringify({ok:true,alert:!!document.querySelector('[role="alert"]'),request:!!document.querySelector('[data-active-request]'),emergency:!!document.querySelector('a[href="tel:112"]')}); })()`,
  'slice-b-flow': `(() => { const click=(selector)=>{const item=document.querySelector(selector);if(!item)throw new Error('missing '+selector);item.click();}; click('[data-safe="true"]');click('[data-safe-stop]');click('[data-request="information"]');const translation=document.querySelector('[data-value="translation"]');translation.value='Authority requested driver information';translation.dispatchEvent(new Event('change',{bubbles:true}));click('[data-channel="email"]');click('[data-prepare]');click('[data-confirm-external]');click('[data-disposition="RESOLVED"]');const value=JSON.parse(localStorage.getItem('agm.premium.operational-case.v1:road-control'));return JSON.stringify({ok:true,state:value.state,effect:value.externalEffects[0]?.phase,automaticSend:value.externalEffects.some(item=>item.phase==='SENT'||item.phase==='RECEIPT_CONFIRMED')}); })()`,
  'slice-b-offline': `(() => { Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});localStorage.removeItem('agm.premium.operational-case.v1:road-control');location.reload();return JSON.stringify({ok:true}); })()`,
  'slice-b-offline-flow': `(() => { Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});const click=(selector)=>{const item=document.querySelector(selector);if(!item)throw new Error('missing '+selector);item.click();};click('[data-safe="true"]');click('[data-safe-stop]');click('[data-request="information"]');const language=document.querySelector('[data-road-control] [data-language]');language.value='sq';language.dispatchEvent(new Event('change',{bubbles:true}));const value=JSON.parse(localStorage.getItem('agm.premium.operational-case.v1:road-control'));const outbox=JSON.parse(localStorage.getItem('agm.premium.operational-outbox.v1')||'[]').filter(item=>item.moduleId==='premium-road-control');return JSON.stringify({ok:true,language:localStorage.getItem('agm.premium.language'),state:value.state,safelyStopped:value.data.safelyStopped,syncStatus:value.data.syncStatus,outbox:outbox.length,automaticSend:value.externalEffects.some(item=>item.phase==='SENT'||item.phase==='RECEIPT_CONFIRMED')}); })()`,
  'slice-b-state': `(() => { const value=JSON.parse(localStorage.getItem('agm.premium.operational-case.v1:road-control')||'null');const outbox=JSON.parse(localStorage.getItem('agm.premium.operational-outbox.v1')||'[]').filter(item=>item.moduleId==='premium-road-control');return JSON.stringify({url:location.href,language:localStorage.getItem('agm.premium.language'),state:value?.state,safelyStopped:value?.data?.safelyStopped,syncStatus:value?.data?.syncStatus,outbox:outbox.length,automaticSend:value?.externalEffects?.some(item=>item.phase==='SENT'||item.phase==='RECEIPT_CONFIRMED')??false}); })()`,
  'slice-b-outbox-audit': `(() => { const value=JSON.parse(localStorage.getItem('agm.premium.operational-case.v1:road-control')||'null');const outbox=JSON.parse(localStorage.getItem('agm.premium.operational-outbox.v1')||'[]').filter(item=>item.moduleId==='premium-road-control');const current=outbox.filter(item=>item.payload?.caseId===value?.id);return JSON.stringify({total:outbox.length,current:current.length,uniqueOperationIds:new Set(current.map(item=>item.operationId)).size,revisions:current.map(item=>item.payload.caseRevision),phases:current.map(item=>item.payload.caseSnapshot.externalEffects?.at(-1)?.phase??null),automaticSend:current.some(item=>item.payload.caseSnapshot.externalEffects?.some(effect=>effect.phase==='SENT'||effect.phase==='RECEIPT_CONFIRMED'))}); })()`,
  'field-batch-open': `(() => { location.href='/before-departure.html'; return JSON.stringify({ok:true}); })()`,
  'field-batch-reset': `(() => { localStorage.removeItem('agm.premium.field-batch-01.v1');localStorage.removeItem('agm.premium.field-batch-01.active');localStorage.setItem('agm.premium.language','ro');location.reload();return JSON.stringify({ok:true}); })()`,
  'field-batch-run': `(() => { const id=${JSON.stringify(requestedLanguage)};const select=document.querySelector('[data-situation]');if(!select)return JSON.stringify({ok:false,reason:'missing-selector',url:location.href});select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));for(const key of ['condition','evidence','remediation']){const button=document.querySelector('[data-answer="'+key+':confirmed"]');if(!button)return JSON.stringify({ok:false,reason:'missing-'+key});button.click();}const human=document.querySelector('[data-human]');if(!human)return JSON.stringify({ok:false,reason:'missing-human'});human.checked=true;human.dispatchEvent(new Event('change',{bubbles:true}));const result=document.querySelector('[data-result]');if(!result||result.disabled)return JSON.stringify({ok:false,reason:'result-disabled'});result.click();const all=JSON.parse(localStorage.getItem('agm.premium.field-batch-01.v1')||'{}'),value=all[id];return JSON.stringify({ok:true,id,state:value?.state,verdict:value?.data?.verdict,syncStatus:value?.data?.syncStatus}); })()`,
  'field-batch-audit': `(() => { const all=JSON.parse(localStorage.getItem('agm.premium.field-batch-01.v1')||'{}');const ids=['trip-context','vehicle-safety','load-securing','tachograph-time','adr-compliance','route-compatibility','night-weather','driver-fitness','ready-gate'];return JSON.stringify({url:location.href,count:Object.keys(all).length,results:ids.map(id=>({id,state:all[id]?.state,verdict:all[id]?.data?.verdict,syncStatus:all[id]?.data?.syncStatus})),language:localStorage.getItem('agm.premium.language')}); })()`,
  'field-batch-02-open': `(() => { location.href='/after-departure.html'; return JSON.stringify({ok:true}); })()`,
  'field-batch-02-reset': `(() => { localStorage.removeItem('agm.premium.field-batch-02.v1');localStorage.removeItem('agm.premium.field-batch-02.active');localStorage.removeItem('agm.premium.field-batch-02.safety.v1');localStorage.setItem('agm.premium.language','ro');location.reload();return JSON.stringify({ok:true}); })()`,
  'field-batch-02-unsafe': `(() => { const root=document.querySelector('agm-after-field-batch'),button=root?.querySelector('[data-safe="false"]');if(!button)return JSON.stringify({ok:false,reason:'missing-unsafe'});button.click();return JSON.stringify({ok:true,alert:!!root.querySelector('[role="alert"]'),selector:!!root.querySelector('[data-after-situation]')}); })()`,
  'field-batch-02-danger': `(() => { const root=document.querySelector('agm-after-field-batch'),click=(selector)=>{const item=root?.querySelector(selector);if(!item)throw new Error('missing '+selector);item.click();};click('[data-safe="true"]');click('[data-danger="true"]');return JSON.stringify({ok:true,emergency:!!root.querySelector('a[href="tel:112"]'),selector:!!root.querySelector('[data-after-situation]')}); })()`,
  'field-batch-02-run': `(() => { const id=${JSON.stringify(requestedLanguage)},root=document.querySelector('agm-after-field-batch'),click=(selector)=>{const item=root?.querySelector(selector);if(!item)throw new Error('missing '+selector);item.click();};const danger=root?.querySelector('[data-danger="false"]');if(danger)danger.click();const select=root?.querySelector('[data-after-situation]');if(!select)return JSON.stringify({ok:false,reason:'missing-selector'});select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));const facts=root.querySelector('[data-facts]');facts.value='Android field evidence '+id;facts.dispatchEvent(new Event('change',{bubbles:true}));const human=root.querySelector('[data-human]');human.checked=true;human.dispatchEvent(new Event('change',{bubbles:true}));if(id==='independent-communication'){click('[data-channel="email"]');click('[data-prepare]');click('[data-confirm-external]');}click('[data-disposition="RESOLVED"]');const all=JSON.parse(localStorage.getItem('agm.premium.field-batch-02.v1')||'{}'),value=all[id];return JSON.stringify({ok:true,id,state:value?.state,humanConfirmed:value?.data?.humanConfirmed,syncStatus:value?.data?.syncStatus,automaticSend:value?.externalEffects?.some(effect=>effect.phase==='SENT'||effect.phase==='RECEIPT_CONFIRMED')??false}); })()`,
  'field-batch-02-audit': `(() => { const all=JSON.parse(localStorage.getItem('agm.premium.field-batch-02.v1')||'{}'),ids=['incident-accident','vehicle-breakdown','driver-fatigue','cargo-issue','route-blocked','weather-road','language-barrier','route-document','independent-communication','arrival-closeout','final-report-archive'];return JSON.stringify({url:location.href,count:Object.keys(all).length,results:ids.map(id=>({id,state:all[id]?.state,humanConfirmed:all[id]?.data?.humanConfirmed,syncStatus:all[id]?.data?.syncStatus,automaticSend:all[id]?.externalEffects?.some(effect=>effect.phase==='SENT'||effect.phase==='RECEIPT_CONFIRMED')??false})),safety:JSON.parse(localStorage.getItem('agm.premium.field-batch-02.safety.v1')||'null'),language:localStorage.getItem('agm.premium.language')}); })()`,
  'slice-a-delete-current-original': `(async () => {
    const current=JSON.parse(localStorage.getItem('agm.premium.operational-case.v1')??'null');
    const original=current?.evidence?.find(item=>item.kind==='original'); if(!original)return JSON.stringify({ok:false,reason:'missing-original'});
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('agm-premium-evidence-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('originals','readwrite');tx.objectStore('originals').delete(original.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
    return JSON.stringify({ok:true,originalId:original.id});
  })()`,
  'access-api-probe': `(async () => {
    const probe = async (url, init) => { try { const response = await fetch(url, init); return { ok: response.ok, status: response.status, type: response.type }; } catch (error) { return { ok: false, error: String(error) }; } };
    return JSON.stringify({
      online: navigator.onLine,
      health: await probe('https://api.agmcockpit.com/api/v1/health'),
      refresh: await probe('https://api.agmcockpit.com/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    });
  })()`,
  'access-production-login-probe': `(async () => {
    try {
      const response = await fetch('https://api.agmcockpit.com/api/v1/auth/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-probe@example.invalid', password: 'invalid-probe-value' })
      });
      return JSON.stringify({ ok: response.ok, status: response.status, type: response.type, allowOrigin: response.headers.get('access-control-allow-origin'), allowCredentials: response.headers.get('access-control-allow-credentials') });
    } catch (error) { return JSON.stringify({ ok: false, error: String(error) }); }
  })()`,
  'access-local-api-probe': `(async () => {
    const probe = async (url, init) => { try { const response = await fetch(url, init); return { ok: response.ok, status: response.status, type: response.type, allowOrigin: response.headers.get('access-control-allow-origin') }; } catch (error) { return { ok: false, error: String(error) }; } };
    const base = 'http://127.0.0.1:3002/api/v1';
    return JSON.stringify({
      online: navigator.onLine,
      health: await probe(base + '/health'),
      loginRoute: await probe(base + '/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'invalid-probe@example.invalid', password: 'invalid-probe-value' }) }),
      refreshRoute: await probe(base + '/auth/refresh', { method: 'POST', credentials: 'include' })
    });
  })()`,
  inspect: `JSON.stringify({
    url: location.href,
    script: [...document.scripts].map((item) => item.src).find((src) => src.includes('/assets/main-')) ?? '',
    actions: [...document.querySelectorAll('[data-basic-action]')].map((item) => item.getAttribute('data-basic-action'))
  })`,
  'premium-assistant-state': `JSON.stringify({
    url: location.href,
    online: navigator.onLine,
    transcript: document.querySelector('[data-assistant-transcript]')?.value ?? '',
    status: document.querySelector('[data-assistant-status]')?.textContent?.trim() ?? '',
    submitDisabled: document.querySelector('[data-assistant-confirm]')?.disabled ?? null,
    responseHidden: document.querySelector('[data-assistant-response-panel]')?.hidden ?? null,
    response: document.querySelector('[data-assistant-response]')?.textContent?.trim() ?? '',
    responsePanelText: document.querySelector('[data-assistant-response-panel]')?.innerText?.trim() ?? ''
  })`,
  'premium-assistant-submit': `(() => {
    const button = document.querySelector('[data-assistant-confirm]');
    if (!button || button.disabled) return JSON.stringify({ ok: false, reason: 'submit-disabled-or-missing' });
    button.click();
    return JSON.stringify({ ok: true });
  })()`,
  'premium-assistant-prepare': `(() => {
    const textarea = document.querySelector('[data-assistant-transcript]');
    if (!textarea) return JSON.stringify({ ok: false, reason: 'missing-transcript' });
    textarea.value = ${JSON.stringify(requestedText)};
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return JSON.stringify({ ok: true, transcript: textarea.value });
  })()`,
  'premium-access-state': `JSON.stringify({
    url: location.href,
    state: document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') ?? '',
    status: document.querySelector('[data-access-status]')?.textContent?.trim() ?? '',
    premiumLinkHidden: document.querySelector('[data-access-premium-link]')?.hidden ?? null
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
  const timeout = setTimeout(() => reject(new Error('CDP response timeout.')), 45_000);
  socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
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
