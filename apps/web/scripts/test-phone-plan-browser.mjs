import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const evidence=path.resolve('../../evidence/agma-conversation-planning-20261121');
await mkdir(evidence,{recursive:true});
const server=await createServer({root:process.cwd(),configFile:false,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use((req,res,next)=>{
 if(!req.url.startsWith('/__phone_plan_audit'))return next();
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="premium-copilot-view"><main>
 <div class="copilot-core"><h1>AGMa</h1><div class="copilot-tools" data-tools></div></div>
 <textarea data-assistant-transcript hidden>Organizează întâlnirea și mesajul pentru Mona.</textarea>
 <p data-assistant-response hidden>Propun întâlnirea la 14:00 și pregătirea mesajului pentru confirmare.</p><p data-assistant-status role="status"></p>
 </main><script type="module">
 import '/src/premium-copilot/copilot.css';
 import {bindPhonePlanHandoff} from '/src/premium-capabilities/phone-plan-handoff.ts';
 const root=document.body;const transcript=root.querySelector('[data-assistant-transcript]');
 root.querySelector('[data-assistant-response]').dataset.answerFor=transcript.value;
 window.calls=[];window.defer=false;
 bindPhonePlanHandoff(root,'ro',root.querySelector('[data-tools]'),async options=>{
  if(window.defer)await new Promise(resolve=>{window.release=resolve});
  if(!options.stillAuthorized())return {status:'UNAVAILABLE'};
  window.calls.push({text:options.contextText,sensitivity:options.sensitivity});return {status:'OPENED'};
 });window.ready=true;
 </script></html>`);
});
await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const cases=[];
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(base+'/__phone_plan_audit',{waitUntil:'domcontentloaded',timeout:60000})).status(),200);
  await page.waitForFunction(()=>window.ready,{},{timeout:60000});
  const prepare=page.locator('[data-phone-plan-prepare]');const editor=page.locator('[data-phone-plan-text]');const confirm=page.locator('[data-phone-plan-confirm]');
  await prepare.click();assert.match(await editor.inputValue(),/14:00/);assert.equal(await page.evaluate(()=>window.calls.length),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(evidence,`phone-plan-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Anulează',exact:true}).click();assert.equal(await page.evaluate(()=>window.calls.length),0);
  await prepare.click();await editor.fill('Pregătește o întâlnire la 15:00. Cere confirmarea înainte de salvare.');await confirm.click();
  await page.waitForFunction(()=>window.calls.length===1);
  assert.equal((await page.evaluate(()=>window.calls[0])).text,'Pregătește o întâlnire la 15:00. Cere confirmarea înainte de salvare.');
  assert.equal(await page.locator('[data-phone-plan-preview]').getAttribute('data-handoff-result'),'OPENED');
  await prepare.click();await page.evaluate(()=>{const t=document.querySelector('[data-assistant-transcript]');t.value='Altă cerere';t.dispatchEvent(new Event('input'));});
  assert.equal(await page.locator('[data-phone-plan-preview]').isVisible(),false);
  await prepare.click();assert.equal(await editor.inputValue(),'Altă cerere');
  await editor.evaluate(el=>{el.value='x'.repeat(2001);el.dispatchEvent(new Event('input'));});assert.equal(await confirm.isDisabled(),true);
  await editor.fill('sk-'+ 'x'.repeat(24));assert.equal(await confirm.isDisabled(),true);
  await editor.fill('Plan revizuit');await page.evaluate(()=>{window.defer=true});await confirm.click();await page.waitForFunction(()=>!!window.release);console.log('deferred',width);
  await page.getByRole('button',{name:'Anulează',exact:true}).click();await page.evaluate(()=>window.release());
  await page.waitForFunction(()=>document.querySelector('[data-phone-plan-preview]').dataset.handoffResult==='UNAVAILABLE');
  assert.equal(await page.evaluate(()=>window.calls.length),1);assert.deepEqual(errors,[]);
  cases.push({width,status:'PASS',checks:['preview only','explicit edited handoff','cancel','stale request invalidation','oversize blocked','secret-like value blocked','cancel during authorization']});
  await page.close();
 }
 const report={scope:'Actual phone-plan UI and source; native assistant is an explicit test double, no phone execution claimed',base,browser:{'Browser Plugin Status':'PASS','Integrated Browser Control Status':'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE','Browser Session Status':'PASS','Target Page Status':'PASS'},cases};
 await writeFile(path.join(evidence,'phone-plan-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await server.close();}
