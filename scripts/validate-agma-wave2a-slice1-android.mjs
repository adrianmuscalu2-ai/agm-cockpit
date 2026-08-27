import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { rejectAuthMockingOnOwnerDevice } from './physical-owner-session-policy.mjs';

rejectAuthMockingOnOwnerDevice({ runner: 'validate-agma-wave2a-slice1-android' });

const root=process.cwd(),adb=path.join(process.env.LOCALAPPDATA,'Android','Sdk','platform-tools','adb.exe');
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out=path.join(root,'evidence','agma-wave2a','slice-1','android',runId);
const results=[];let browser,fatal;await mkdir(out,{recursive:true});
const shell=(...args)=>execFileSync(adb,args,{encoding:'utf8'});
const resumed=()=>shell('shell','dumpsys','activity','activities').split(/\r?\n/).find(line=>line.includes('topResumedActivity'))?.trim()??'';
async function pageForApp(){
  const socket=shell('shell','cat','/proc/net/unix').match(/@(webview_devtools_remote_\d+)/)?.[1];if(!socket)throw Error('Android WebView debug socket unavailable');
  shell('forward','tcp:9222',`localabstract:${socket}`);
  browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>!p.url().includes('sw.js'));
  if(!page)throw Error('Android WebView unavailable');
  await page.evaluate(async()=>{for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister()});
  await page.addInitScript(()=>{const nativeFetch=window.fetch.bind(window);window.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url;if(url.endsWith('/auth/login'))return new Response(JSON.stringify({data:{accessToken:'android-slice1-token',user:{id:'owner',displayName:'Owner',email:'owner@example.test',roles:['PREMIUM_ACCESS']}},requestId:'android-slice1'}),{status:200,headers:{'content-type':'application/json'}});if(url.endsWith('/auth/entitlements'))return new Response(JSON.stringify({data:{subjectId:'owner',tier:'premium',status:'active',capabilities:['premium.command-center','premium.voice-assistant'],evaluatedAt:new Date().toISOString(),policyVersion:'access-entitlements@1.0.0'},requestId:'android-slice1'}),{status:200,headers:{'content-type':'application/json'}});return nativeFetch(input,init)}});
  await page.route('**/api/v1/**',async route=>{const u=route.request().url();let data={};if(u.endsWith('/auth/login'))data={accessToken:'android-slice1-token',user:{id:'owner',displayName:'Owner',email:'owner@example.test',roles:['PREMIUM_ACCESS']}};else if(u.endsWith('/auth/entitlements'))data={subjectId:'owner',tier:'premium',status:'active',capabilities:['premium.command-center','premium.voice-assistant'],evaluatedAt:new Date().toISOString(),policyVersion:'access-entitlements@1.0.0'};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})})});
  await page.evaluate(()=>{localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13',JSON.stringify({privacyPolicyVersion:'privacy-v2026.07.13',termsVersion:'terms-v2026.07.13',acceptedAt:new Date().toISOString()}));localStorage.setItem('agm.tutorial.completed.v1',new Date().toISOString());localStorage.setItem('agm.premium.single-copilot.enabled','true');localStorage.setItem('agm.wave2a.slice1.enabled','true');sessionStorage.setItem('agm.auth.accessToken','android-slice1-token');history.pushState({},'','/access')});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state')==='premium');await page.evaluate(()=>{history.pushState({},'','/premium');dispatchEvent(new PopStateEvent('popstate'))});await page.waitForSelector('[data-premium-copilot]');return page;
}
async function scenario(id,text,expectedPackages){
  const startedAt=new Date().toISOString(),page=await pageForApp();await page.locator('[data-assistant-transcript]').fill(text);await page.locator('[data-copilot-route]').click();await page.locator('[data-capability-preview]').waitFor({state:'visible'});
  const preview=path.join(out,`${id}-preview.png`);await page.screenshot({path:preview,fullPage:true});await page.locator('[data-capability-confirm]').click();await page.waitForTimeout(1500);const activity=resumed();
  if(!expectedPackages.some(expected=>activity.toLowerCase().includes(expected)))throw Error(`${id}: unexpected activity ${activity}`);
  const native=path.join(out,`${id}-native.png`),fd=openSync(native,'w');try{execFileSync(adb,['exec-out','screencap','-p'],{encoding:null,stdio:['ignore',fd,'inherit']})}finally{closeSync(fd)}
  results.push({id,status:'PASS',startedAt,finishedAt:new Date().toISOString(),activity,preview:path.relative(root,preview),nativeScreenshot:path.relative(root,native)});await browser.close();browser=undefined;shell('shell','am','force-stop','com.google.android.apps.maps');shell('shell','am','force-stop','com.samsung.android.dialer');shell('shell','monkey','-p','com.agm.cockpit','-c','android.intent.category.LAUNCHER','1');await new Promise(r=>setTimeout(r,1500));
}
try{const only=process.argv[2];if(only!=='maps')await scenario('open-dialer','Sună Mihai +49 7131 555555',['dialer']);if(only!=='dialer')await scenario('open-maps','Deschide navigația către Heilbronn',['maps','resolveractivity']);}catch(e){fatal=String(e)}finally{await browser?.close();const expected=process.argv[2]?1:2,report={schemaVersion:1,runId,status:!fatal&&results.length===expected?'PASS':'FAIL',device:'Samsung SM-S931B',serial:'RFCY70WDHXK',package:'com.agm.cockpit',apkSha256:'AB274A661CFF0742D3A1678D4E0C234DD0F6AE80BBB17CBF683B3D56255709E7',results,fatal,finishedAt:new Date().toISOString()};await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(`AGMA WAVE 2A SLICE 1 ANDROID: ${report.status}`);console.log(path.join(out,'report.json'));if(report.status!=='PASS')process.exitCode=1}
