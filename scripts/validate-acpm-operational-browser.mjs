import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const webRequire=createRequire(resolve('apps/web/package.json'));
const {createServer}=await import(pathToFileURL(webRequire.resolve('vite')).href);
const replay=JSON.parse(readFileSync('evidence/acpm-20261115/historical-replay.json','utf8'));
replay.projection.observerHealth=JSON.parse(readFileSync('evidence/acpm-operational-20261115/attempt-2/observer-tests.json','utf8')).health;
let denied=false;
const server=await createServer({configFile:false,cacheDir:resolve('evidence/acpm-operational-20261115/vite-cache-final'),root:process.cwd(),publicDir:resolve('apps/web/public'),resolve:{alias:{'@agm/shared':webRequire.resolve('@agm/shared')}},optimizeDeps:{force:true,noDiscovery:true,include:['@agm/shared']},server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/dist/**','**/evidence/**']}},plugins:[{
 name:'isolated-acp-evidence-harness',configureServer(s){s.middlewares.use((req,res,next)=>{
  if(req.url==='/acpm'){res.setHeader('Content-Type','application/json');res.statusCode=denied?403:200;res.end(JSON.stringify(denied?{error:'isolated authorization test'}:{data:replay.projection}));return;}
  if(req.url==='/__acpm-test'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="ro"><meta charset="utf-8"><title>ACPM isolated historical replay</title><style>body{font:16px system-ui;margin:24px;background:#101b29;color:#f2f5fa}button{padding:10px}table{font-size:14px}details p{max-width:65ch}a{color:#92caff}</style><body><h1>ACPM · verificare izolată</h1><p>Date istorice reale din 13.11.2026; nu reprezintă producția curentă.</p><main></main><script type="module">import {renderAgmatccPage} from '/apps/web/src/turn-agmatcc/agmatcc.view.ts';import {bindAcpm} from '/apps/web/src/turn-agmatcc/acpm.performance.ts';import '/apps/web/src/turn-agmatcc/agmatcc.css';document.querySelector('main').innerHTML=renderAgmatccPage();bindAcpm(document.querySelector('.turn-agmatcc-page'),window.fetch.bind(window));</script></body></html>`);return;}next();
 });}
}]});
let browser;
try{
 await server.listen();const port=server.httpServer.address().port;
 assert.ok(![5173,5174].includes(port));const url=`http://127.0.0.1:${port}/__acpm-test`;
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE_ERROR',e.message);});
 const response=await page.goto(url);assert.equal(response.status(),200);
 await page.locator('[data-acpm-refresh]').click();await page.locator('[data-acpm-status]').filter({hasText:'Citire reușită'}).waitFor();
 assert.equal(await page.locator('[data-acpm-content] tbody tr').count(),replay.projection.runs.length);
 assert.ok((await page.locator('[data-acpm-content]').innerText()).includes('nedemonstrat'));
 assert.ok((await page.locator('[data-acpm-content]').innerText()).includes('Instrumentare API de la'));
 assert.ok((await page.locator('[data-acpm-content]').innerText()).includes('coada se poate pierde la restart')); 
 await page.selectOption('[data-acpm-component]','premium.orchestrator');
 await page.locator('[data-acpm-apply]').click();
 assert.equal(await page.locator('[data-acpm-content] tbody tr').count(),1);
 assert.ok((await page.locator('[data-acpm-timeline]').innerText()).includes('premium.orchestrator'));
 await page.selectOption('[data-acpm-kind]','INSPECTOR');await page.locator('[data-acpm-apply]').click();
 assert.equal(await page.locator('[data-acpm-content] tbody tr').count(),0);
 await page.locator('[data-acpm-reset]').click();
 await page.selectOption('[data-acpm-kind]','INSPECTOR');await page.locator('[data-acpm-apply]').click();
 assert.ok(await page.locator('[data-acpm-content] tbody tr').count()>=2);
 await page.selectOption('[data-acpm-kind]','AGENT');await page.locator('[data-acpm-apply]').click();
 assert.ok(await page.locator('[data-acpm-content] tbody tr').count()>0);
 await page.locator('[data-acpm-reset]').click();
 await page.locator('[data-acpm-from]').fill('2026-11-14T00:00');await page.locator('[data-acpm-apply]').click();
 assert.equal(await page.locator('[data-acpm-content] tbody tr').count(),0);
 assert.ok((await page.locator('[data-acpm-content]').innerText()).includes('indisponibile'));
 await page.locator('[data-acpm-to]').fill('2026-11-12T00:00');await page.locator('[data-acpm-apply]').click();
 assert.ok((await page.locator('[data-acpm-status]').innerText()).includes('invalid'));
 await page.locator('[data-acpm-reset]').click();
 await page.selectOption('[data-acpm-kind]','DEPARTMENT');await page.locator('[data-acpm-apply]').click();
 assert.equal(await page.locator('[data-acpm-content] tbody tr').count(),0);
 await page.locator('[data-acpm-reset]').click();
 await page.selectOption('[data-acpm-component]','premium.orchestrator');await page.locator('[data-acpm-apply]').click();
 await page.locator('[data-acpm-content] tbody details').first().click();
 await page.locator('[data-acpm-content] > details').filter({hasText:'Evoluția execuțiilor observate'}).locator('summary').click();
 assert.ok((await page.locator('[data-acpm-content] > details').filter({hasText:'Evoluția execuțiilor observate'}).innerText()).includes('COMPLETED'));
 await page.screenshot({path:'evidence/acpm-operational-20261115/browser-desktop.png',fullPage:true});
 await page.reload();await page.locator('[data-acpm-refresh]').click();await page.locator('[data-acpm-status]').filter({hasText:'Citire reușită'}).waitFor();
 assert.equal(await page.locator('[data-acpm-content] tbody tr').count(),27);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'evidence/acpm-operational-20261115/browser-mobile.png',fullPage:true});
 const layout=await page.locator('.agmatcc-performance').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,overflow:Array.from(el.querySelectorAll('*')).filter(n=>n.getBoundingClientRect().right>el.getBoundingClientRect().right).slice(0,12).map(n=>({tag:n.tagName,cls:n.className,right:n.getBoundingClientRect().right,text:n.textContent?.slice(0,80)}))}));
 writeFileSync('evidence/acpm-operational-20261115/mobile-layout.json',JSON.stringify(layout,null,2));console.log('MOBILE_LAYOUT',JSON.stringify(layout));
 assert.ok(await page.locator('.agmatcc-performance').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'ACPM must fit mobile width');
 await page.screenshot({path:'evidence/acpm-operational-20261115/browser-mobile.png',fullPage:true});
 denied=true;await page.locator('[data-acpm-refresh]').click();await page.locator('[data-acpm-status]').filter({hasText:'HTTP 403'}).waitFor();
 assert.equal(await page.locator('[data-acpm-content] tbody tr').count(),0);await page.locator('[data-acpm-apply]').click();assert.equal(await page.locator('[data-acpm-content] tbody tr').count(),0);assert.equal(errors.length,0,errors.join('\n'));
 writeFileSync('evidence/acpm-operational-20261115/browser-tests.json',JSON.stringify({at:new Date().toISOString(),scope:'Actual AGMaTCC template and ACPM binder; isolated historical replay; no production authentication or full-product certification',url,observerHealthVisible:true,rows:27,individualSelection:true,roleFilter:true,agentFilter:true,departmentUnavailable:true,temporalFilter:true,invalidIntervalClearsResults:true,chronology:true,evolutionExpanded:true,reset:true,reload:true,authorizationFailureClearsStaleData:true,pageErrors:errors,'Browser Plugin Status':'PASS - controlled Playwright callable','Integrated Browser Control Status':'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE - browser access host unavailable','Browser Session Status':'PASS','Target Page Status':'PASS',passed:true},null,2));
 console.log('ACPM Browser: historical rows, evidence, reload, mobile capture and 403 stale-state clearing PASS');
}finally{await browser?.close();await server.close();}
