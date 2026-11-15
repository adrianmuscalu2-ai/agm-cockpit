import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const webRequire=createRequire(resolve('apps/web/package.json'));
const {createServer}=await import(pathToFileURL(webRequire.resolve('vite')).href);
const replay=JSON.parse(readFileSync('evidence/acp-20261115/historical-replay.json','utf8'));
let denied=false;
const server=await createServer({configFile:false,root:process.cwd(),publicDir:resolve('apps/web/public'),optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0},plugins:[{
 name:'isolated-acp-evidence-harness',configureServer(s){s.middlewares.use((req,res,next)=>{
  if(req.url==='/agent-chain-performance'){res.setHeader('Content-Type','application/json');res.statusCode=denied?403:200;res.end(JSON.stringify(denied?{error:'isolated authorization test'}:{data:replay.projection}));return;}
  if(req.url==='/__acp-test'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="ro"><meta charset="utf-8"><title>ACP isolated historical replay</title><style>body{font:16px system-ui;margin:24px;background:#101b29;color:#f2f5fa}button{padding:10px}table{font-size:14px}details p{max-width:65ch}a{color:#92caff}</style><body><h1>ACP · verificare izolată</h1><p>Date istorice reale din 13.11.2026; nu reprezintă producția curentă.</p><main></main><script type="module">import {renderAgmatccPage} from '/apps/web/src/turn-agmatcc/agmatcc.view.ts';import {bindPerformance} from '/apps/web/src/turn-agmatcc/agmatcc.performance.ts';import '/apps/web/src/turn-agmatcc/agmatcc.css';document.querySelector('main').innerHTML=renderAgmatccPage();bindPerformance(document.querySelector('.turn-agmatcc-page'),window.fetch.bind(window));</script></body></html>`);return;}next();
 });}
}]});
let browser;
try{
 await server.listen();const port=server.httpServer.address().port;
 assert.ok(![5173,5174].includes(port));const url=`http://127.0.0.1:${port}/__acp-test`;
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(url);assert.equal(response.status(),200);
 await page.locator('[data-acp-refresh]').click();await page.locator('[data-acp-status]').filter({hasText:'Citire reușită'}).waitFor();
 assert.equal(await page.locator('[data-acp-content] tbody tr').count(),replay.projection.runs.length);
 assert.ok((await page.locator('[data-acp-content]').innerText()).includes('nedemonstrat'));
 await page.locator('[data-acp-content] details').first().click();
 await page.screenshot({path:'evidence/acp-20261115/browser-desktop.png',fullPage:true});
 await page.reload();await page.locator('[data-acp-refresh]').click();await page.locator('[data-acp-status]').filter({hasText:'Citire reușită'}).waitFor();
 assert.equal(await page.locator('[data-acp-content] tbody tr').count(),27);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.locator('.agmatcc-performance').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'ACP must fit mobile width');
 await page.screenshot({path:'evidence/acp-20261115/browser-mobile.png',fullPage:true});
 denied=true;await page.locator('[data-acp-refresh]').click();await page.locator('[data-acp-status]').filter({hasText:'HTTP 403'}).waitFor();
 assert.equal(await page.locator('[data-acp-content] tbody tr').count(),0);assert.equal(errors.length,0,errors.join('\n'));
 writeFileSync('evidence/acp-20261115/browser-tests.json',JSON.stringify({at:new Date().toISOString(),scope:'Actual AGMaTCC template and ACP binder; isolated historical replay; no production authentication or full-product certification',url,rows:27,reload:true,authorizationFailureClearsStaleData:true,pageErrors:errors,'Browser Plugin Status':'PASS - controlled Playwright callable','Integrated Browser Control Status':'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE - browser access host unavailable','Browser Session Status':'PASS','Target Page Status':'PASS',passed:true},null,2));
 console.log('ACP Browser: historical rows, evidence, reload, mobile capture and 403 stale-state clearing PASS');
}finally{await browser?.close();await server.close();}
