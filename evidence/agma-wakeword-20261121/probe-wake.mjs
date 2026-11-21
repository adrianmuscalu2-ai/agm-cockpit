import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const choices={maps:{text:'Deschide aplica\u021bia Maps la Dieselstra\u00dfe 5, 70469 Stuttgart',package:'com.google.android.apps.maps'}};
const name='maps', choice=choices[name];
if(!choice)throw Error('Expected maps, waze or tomtom');
const adb=path.join(process.env.LOCALAPPDATA,'Android','Sdk','platform-tools','adb.exe');
const shell=(...args)=>execFileSync(adb,args,{encoding:'utf8',timeout:15000});
shell('shell','am','start','-n','com.agm.cockpit.assistantpilot/com.agm.cockpit.MainActivity');
const pid=shell('shell','pidof','com.agm.cockpit.assistantpilot').trim().split(/\s+/)[0];
const port=shell('forward','tcp:0',`localabstract:webview_devtools_remote_${pid}`).trim();
let browser;
try{
 for(let attempt=0;attempt<30;attempt++) { try { const ready=await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(1500)}); if(ready.ok) break; } catch {} await new Promise(r=>setTimeout(r,500)); }
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:15000});
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('https://localhost'));
 if(!page)throw Error('PILOT_WEBVIEW_MISSING');
 page.setDefaultTimeout(15000);
 if(process.argv[2]==='inspect') {
   console.log(JSON.stringify({url:page.url(),title:await page.title(),headings:await page.locator('h1,h2').allTextContents(),buttons:await page.locator('button').allTextContents(),passwordFields:await page.locator('input[type=password]').count(),wakeControls:await page.locator('[data-local-wake]').count()}));
   console.log(JSON.stringify({accessStatus:await page.locator('[data-access-status]').allTextContents(),hasSession:await page.evaluate(()=>Boolean(sessionStorage.getItem('agm.auth.accessToken'))),wake:await page.evaluate(()=>window.Capacitor.Plugins.AgmWake.status())}));
   process.exitCode=0;
 } else {
 if(!(await page.locator('[data-premium-assistant]').count()))await page.evaluate(()=>{history.pushState({},'','/premium/voice');dispatchEvent(new PopStateEvent('popstate'));});
 await page.locator('[data-premium-assistant]').waitFor({state:'visible'});
 const action=process.argv[2]||'status';
 if(!['status','voice-stop','stop'].includes(action) && await page.locator('[data-assistant-start]').getAttribute('aria-pressed')==='true')throw Error('ACTIVE_VOICE_SESSION_DO_NOT_INTERRUPT');
 await page.locator('[data-local-wake]').waitFor({state:'visible'});
 const before=await page.evaluate(()=>window.Capacitor.Plugins.AgmWake.status());
 let audioMonitor;
 if(action==='monitor' || action==='calibration-monitor') {
   if(action==='monitor') shell('shell','input','keyevent','KEYCODE_HOME');
   audioMonitor=[];
   for(let i=0;i<45;i++) {
     const value=await page.evaluate(()=>window.Capacitor.Plugins.AgmWake.status());
     audioMonitor.push({observedAt:new Date().toISOString(),...value});
     if(value.detections>before.detections || !value.armed) break;
     if(action==='calibration-monitor' && !value.calibrating) break;
     await new Promise(r=>setTimeout(r,1000));
   }
 }
 const originalDraft=await page.locator('[data-assistant-transcript]').inputValue();
 if(action==='settings') await page.locator('[data-device-assistant-settings]').click();
 if(action==='arm') await page.locator('[data-wake-arm]').click();
 if(action==='stop') await page.locator('[data-wake-stop]').click();
 if(action==='calibrate') await page.evaluate(()=>window.Capacitor.Plugins.AgmWake.calibrate());
 let fixtureResults;
 if(action==='fixtures') fixtureResults=await page.evaluate(()=>window.Capacitor.Plugins.AgmWake.verifyModelFixtures());
 let handoff;
 if(action==='handoff') {
   if(!before.armed) throw Error('ARM_WAKE_BEFORE_HANDOFF');
   await page.locator('[data-assistant-start]').click();
   await page.waitForFunction(()=>document.querySelector('[data-assistant-start]')?.getAttribute('aria-pressed')==='true');
   await new Promise(r=>setTimeout(r,500));
   handoff = {during:await page.evaluate(()=>window.Capacitor.Plugins.AgmWake.status()), voiceActive:await page.locator('[data-assistant-start]').getAttribute('aria-pressed')};
   await page.locator('[data-assistant-cancel]').click();
   await page.locator('[data-assistant-transcript]').fill(originalDraft);
   await new Promise(r=>setTimeout(r,5000));
 }
 if(action==='voice-stop') {
   await page.locator('[data-assistant-cancel]').click();
   await page.locator('[data-assistant-transcript]').fill(originalDraft);
   await new Promise(r=>setTimeout(r,5000));
 }
 await new Promise(r=>setTimeout(r,1500));
 const after=await page.evaluate(()=>window.Capacitor.Plugins.AgmWake.status());
 const ui=await page.locator('[data-wake-status]').textContent();
 const voiceStatus=await page.locator('[data-assistant-status]').textContent();
 const voiceActive=await page.locator('[data-assistant-start]').getAttribute('aria-pressed');
 const report={at:new Date().toISOString(),action,before,handoff,audioMonitor,fixtureResults,after,ui,voiceStatus,voiceActive};console.log(JSON.stringify(report));
 await writeFile('evidence/agma-wakeword-20261121/probe-'+action+'.json',JSON.stringify(report,null,2));
 }
}finally{await browser?.close();shell('forward','--remove',`tcp:${port}`);}
