import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root=process.cwd();
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(root,'evidence','premium-assistant-sources',runId);
const report={schemaVersion:1,runId,runner:'Controlled AGM Playwright/Chromium',status:'FAIL',browserGate:{browserPluginStatus:'PASS',integratedBrowserControlStatus:'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',browserSessionStatus:'PENDING',targetPageStatus:'PENDING'},checks:{}};
let browser;let server;let page;let sourceRequestAt=0;let sourceFulfilledAt=0;
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=()=>new Promise((resolve,reject)=>{const socket=net.createServer();socket.unref();socket.on('error',reject);socket.listen(0,'127.0.0.1',()=>{const address=socket.address();socket.close(()=>resolve(address.port));});});
const source=(index)=>({sourceId:`CS-${index}`,title:`Sursa canonică ${index}`,origin:index>4?'bmuv.de':'Biblioteca AGM',urlOrIdentifier:index>4?`https://bmuv.de/source-${index}`:`AGM_LIBRARY/source-${index}.md`,timestamp:'2026-09-12T12:00:00.000Z',domain:['LEGISLATION_SAFETY'],language:'ro',confidence:.98,originType:index>4?'WEB':'DOCUMENT_LIBRARY',retrievalType:index>4?'LIVE':index===4?'CACHE':'LIBRARY',freshness:{status:'CURRENT',checkedAt:'2026-09-12T12:00:00.000Z',expiresAt:'2026-09-19T12:00:00.000Z',ttlSeconds:604800},provenance:{canonicalPath:index>4?null:`AGM_LIBRARY/source-${index}.md`,sha256:index>4?null:`sha-${index}`,authorityType:index>4?'EXTERNAL_WEB':'AUTHORITATIVE',reviewStatus:index>4?'LIVE_PROVIDER_OBSERVATION':'APPROVED'}});

await mkdir(out,{recursive:true});
try{
 const port=await freePort();const target=`http://127.0.0.1:${port}`;report.target=target;
 server=spawn(process.execPath,[path.join(root,'apps','web','node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:path.join(root,'apps','web'),windowsHide:true,stdio:'ignore'});
 for(let attempt=0;attempt<80;attempt+=1){try{if((await fetch(target)).status===200)break;}catch{}await delay(150);if(attempt===79)throw new Error('Preview target unavailable');}
 browser=await chromium.launch({headless:true});report.browserGate.browserSessionStatus='PASS';
 page=await browser.newPage({viewport:{width:412,height:915}});
 await page.addInitScript(()=>{
  localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13',JSON.stringify({privacyPolicyVersion:'privacy-v2026.07.13',termsVersion:'terms-v2026.07.13',acceptedAt:new Date().toISOString()}));
  localStorage.setItem('agm.tutorial.completed.v1',new Date().toISOString());
  window.__agmSourceProbe={speakInvokedAt:0,audioStartedAt:0};
  class FakeUtterance{constructor(text){this.text=text;this.lang='';this.onstart=null;this.onend=null;this.onerror=null;}}
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:FakeUtterance});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(utterance){window.__agmSourceProbe.speakInvokedAt=Date.now();setTimeout(()=>{window.__agmSourceProbe.audioStartedAt=Date.now();utterance.onstart?.();},12);},pause(){},resume(){},getVoices(){return[];},speaking:false,pending:false,paused:false}});
 });
 await page.route('**/api/v1/**',async route=>{
  const url=route.request().url();
  if(url.endsWith('/auth/login'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{accessToken:'controlled-source-token',user:{id:'owner',displayName:'Owner',email:'owner@example.test',roles:['PREMIUM_ACCESS']}}})});
  if(url.endsWith('/auth/entitlements'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{subjectId:'owner',tier:'premium',status:'active',capabilities:['premium.command-center','premium.voice-assistant'],evaluatedAt:new Date().toISOString(),policyVersion:'access-entitlements@1.0.0'}})});
  if(url.endsWith('/premium-assistant/respond'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{contractVersion:'premium-assistant.v2',kind:'answer',text:'Răspuns AGM bazat pe context valid.',provider:'openai',productId:'agm-cockpit',moduleId:'premium-cockpit',contextRefs:[],sourceTrace:{traceId:'trace-browser-1',status:'READY',generatedAt:new Date().toISOString(),counts:{total:6,library:3,cache:1,live:2}},cache:{disposition:'MISS',ttlSeconds:60},timing:{timeToFirstTokenMs:180,orchestratorMs:8,modelMs:470,answerCompleteMs:478,serverTotalMs:485,sourceResolutionMs:3},externalEffectPerformed:false}})});
  if(url.includes('/premium-assistant/sources/')){sourceRequestAt=Date.now();await delay(1200);sourceFulfilledAt=Date.now();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{traceId:'trace-browser-1',status:'READY',generatedAt:new Date().toISOString(),counts:{total:6,library:3,cache:1,live:2},sources:Array.from({length:6},(_,index)=>source(index+1))}})});}
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{}})});
 });
 await page.goto(`${target}/access`,{waitUntil:'networkidle'});await page.locator('input[name=email]').fill('owner@example.test');await page.locator('input[name=password]').fill('not-a-real-secret');await page.locator('[data-access-login]').evaluate(form=>form.requestSubmit());await page.waitForFunction(()=>document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state')==='premium');
 await page.evaluate(()=>{history.pushState({},'','/premium/voice');dispatchEvent(new PopStateEvent('popstate'));});await page.locator('[data-premium-assistant]').waitFor({state:'visible'});report.browserGate.targetPageStatus='PASS';
 await page.locator('[data-assistant-transcript]').fill('Ce reguli de tahograf sunt valabile?');await page.locator('[data-assistant-confirm]').click();
 await page.waitForFunction(()=>document.querySelector('[data-assistant-sources-summary]')?.textContent?.includes('Surse: 6')&&window.__agmSourceProbe?.audioStartedAt>0);
 await page.locator('[data-assistant-sources-toggle]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-assistant-sources-list] li').length===6);
 const detail=await page.evaluate(()=>({summary:document.querySelector('[data-assistant-sources-summary]')?.textContent,sourceRows:document.querySelectorAll('[data-assistant-sources-list] li').length,sourceText:document.querySelector('[data-assistant-sources-list]')?.textContent,audio:window.__agmSourceProbe,latency:JSON.parse(sessionStorage.getItem('agm.premium.voice.telemetry.v1')||'[]').filter(row=>row.kind==='assistant-source-latency').at(-1)?.metrics}));
 report.checks={compactSummary:detail.summary==='Surse: 6 · Library 3 · Live 2 · Cache 1',sixSourcesVisible:detail.sourceRows===6,markersVisible:/LIBRARY/.test(detail.sourceText)&&/LIVE/.test(detail.sourceText)&&/CACHE/.test(detail.sourceText),audioInvokedBeforeSourceRequest:detail.audio.speakInvokedAt>0&&detail.audio.speakInvokedAt<=sourceRequestAt,audioStartedBeforeDelayedSourcesComplete:detail.audio.audioStartedAt>0&&detail.audio.audioStartedAt<sourceFulfilledAt,metricsSeparated:['time-to-first-token','time-to-first-audio','answer-complete','sources-visible'].every(key=>Object.hasOwn(detail.latency??{},key))};
 if(Object.values(report.checks).some(value=>!value))throw new Error(`Source presentation checks failed: ${JSON.stringify(report.checks)}`);
 report.metrics=detail.latency;report.timingEvidence={speakInvokedAt:detail.audio.speakInvokedAt,audioStartedAt:detail.audio.audioStartedAt,sourceRequestAt,sourceFulfilledAt,sourceDetailDelayMs:sourceFulfilledAt-sourceRequestAt};
 await page.screenshot({path:path.join(out,'assistant-sources-mobile.png'),fullPage:true});report.status='PASS';
}catch(error){report.fatal=String(error?.stack||error);if(page)await page.screenshot({path:path.join(out,'FAIL.png'),fullPage:true}).catch(()=>{});}finally{
 await browser?.close();if(server)server.kill();report.revision=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();report.finishedAt=new Date().toISOString();await writeFile(path.join(out,'report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(`PREMIUM ASSISTANT SOURCES BROWSER: ${report.status}`);console.log(path.join(out,'report.json'));if(report.status!=='PASS')process.exitCode=1;
}
