import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(root,'evidence','app-i18n','android',runId);
const adb=path.join(process.env.LOCALAPPDATA??'','Android','Sdk','platform-tools','adb.exe');
const apk=path.join(root,'apps','web','android','app','build','outputs','apk','debug','app-debug.apk');
const runFile=promisify(execFile);
const languages={
  it:{profile:'Lingua preferita',access:'Accesso e abbonamento',accessReady:'Accesso Premium valido.',basic:'Traduttore contestuale',premium:'Ecosistema premium',carMover:'Pianifica, confronta ed esegui gli spostamenti dei veicoli usando dati AGM reali.'},
  es:{profile:'Idioma preferido',access:'Acceso y suscripción',accessReady:'Acceso Premium válido.',basic:'Traductor contextual',premium:'Ecosistema premium',carMover:'Planifica, compara y ejecuta movimientos de vehículos con datos reales de AGM.'},
  sv:{profile:'Önskat språk',access:'Åtkomst och abonnemang',accessReady:'Premium-åtkomst giltig.',basic:'Kontextöversättare',premium:'Premium-ekosystem',carMover:'Planera, jämför och utför fordonsförflyttningar med verkliga AGM-data.'},
};
const results=[];
const runtimeErrors=[];
let browser;
let fatal;
await mkdir(out,{recursive:true});
const report={schemaVersion:1,runId,startedAt:new Date().toISOString(),runner:'Physical Android WebView + controlled CDP',deviceStatus:'FAIL',browserSessionStatus:'FAIL',targetPageStatus:'FAIL',results};

try{
  const devices=(await runFile(adb,['devices','-l'])).stdout;
  const deviceLine=devices.split(/\r?\n/).find((line)=>/\sdevice\s/.test(line));
  if(!deviceLine)throw new Error('ANDROID_DEVICE_NOT_CONNECTED');
  report.device=deviceLine.trim();
  report.deviceStatus='PASS';
  report.package=(await runFile(adb,['shell','dumpsys','package','com.agm.cockpit'])).stdout.match(/versionCode=.*|versionName=.*|lastUpdateTime=.*/g)?.slice(0,3)??[];
  report.display=(await runFile(adb,['shell','wm','size'])).stdout.trim();
  report.apkSha256=createHash('sha256').update(await readFile(apk)).digest('hex').toUpperCase();
  await runFile(adb,['shell','am','force-stop','com.agm.cockpit']);
  await runFile(adb,['shell','monkey','-p','com.agm.cockpit','-c','android.intent.category.LAUNCHER','1']);
  await new Promise((resolve)=>setTimeout(resolve,2500));
  const pid=(await runFile(adb,['shell','pidof','com.agm.cockpit'])).stdout.trim().split(/\s+/)[0];
  if(!pid)throw new Error('ANDROID_PROCESS_NOT_RUNNING');
  await runFile(adb,['forward','tcp:9222',`localabstract:webview_devtools_remote_${pid}`]);
  browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page=browser.contexts().flatMap((context)=>context.pages()).find((candidate)=>!candidate.url().includes('sw.js'));
  if(!page)throw new Error('ANDROID_WEBVIEW_PAGE_UNAVAILABLE');
  if(new URL(page.url()).origin!=='https://localhost')throw new Error(`ANDROID_ORIGIN_MISMATCH:${page.url()}`);
  report.browserSessionStatus='PASS';
  page.setDefaultTimeout(10000);
  page.on('pageerror',(error)=>runtimeErrors.push(error.message));
  await page.route('**/api/v1/**',async(route)=>{
    const url=new URL(route.request().url());
    const now=new Date().toISOString();
    if(url.pathname.endsWith('/auth/refresh')){await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'No controlled session'})});return;}
    let data={};
    if(url.pathname.endsWith('/auth/login'))data={accessToken:'controlled-android-i18n-token',user:{id:'android-i18n',displayName:'Android I18n',email:'audit@example.test',roles:['PREMIUM_ACCESS']}};
    else if(url.pathname.endsWith('/auth/entitlements'))data={subjectId:'android-i18n',tier:'premium',status:'active',capabilities:['premium.command-center','premium.voice-assistant','car-mover.jobs'],evaluatedAt:now,policyVersion:'access-entitlements@1.0.0'};
    else if(url.pathname.endsWith('/authority-control-plane/dashboard'))data={contractVersion:'premium-agent-network.v1',controlPlane:{status:'PASS',activeExecutiveAuthorities:1,conflicts:[]},nodes:[],departments:[],opportunityIntelligence:{gate:'GO',reason:'Controlled Android i18n validation'}};
    else if(url.pathname.endsWith('/car-mover/jobs')||url.pathname.endsWith('/communications/providers/status'))data=[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data,requestId:'controlled-android-final-language-wave'})});
  });
  await page.evaluate(()=>{
    sessionStorage.clear();
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13',JSON.stringify({privacyPolicyVersion:'privacy-v2026.07.13',termsVersion:'terms-v2026.07.13',acceptedAt:new Date().toISOString()}));
    localStorage.setItem('agm.tutorial.completed.v1',new Date().toISOString());
  });
  await page.reload({waitUntil:'domcontentloaded'});

  for(const [language,expected] of Object.entries(languages)){
    await navigate(page,'/profile','select[data-language-more="profilePreferredLanguage"]');
    const select=page.locator('select[data-language-more="profilePreferredLanguage"]');
    if(await select.locator(`option[value="${language}"]`).count())await select.selectOption(language);
    else await page.locator(`button[data-language-group="profilePreferredLanguage"][data-language="${language}"]`).click();
    await page.waitForTimeout(250);
    if(await page.evaluate(()=>document.documentElement.lang)!==language)throw new Error(`${language}: Android selector did not change document language`);
    await expectText(page,'body',expected.profile,`${language}: Android profile selector`);
    await navigate(page,'/basic','.basic-hub');
    await capture(page,language,'basic',expected.basic);

    await navigate(page,'/access','[data-access-enforcement]');
    await expectText(page,'body',expected.access,`${language}: Android access view`);
    await navigate(page,'/premium','.premium-governance-view');
    await capture(page,language,'premium',expected.premium);
    await navigate(page,'/car-mover','.car-mover-entry');
    await capture(page,language,'car-mover',expected.carMover);
  }
  if(runtimeErrors.length)throw new Error(`ANDROID_RUNTIME_ERRORS:${JSON.stringify(runtimeErrors)}`);
  report.targetPageStatus='PASS';
  report.probe='Physical Samsung WebView: IT/ES/SV selector, localized Access view, Basic, Premium and Car Mover; 9 controlled DOM checks; no horizontal overflow';
}catch(error){fatal=error instanceof Error?error.stack??error.message:String(error);}
finally{
  await runFile(adb,['forward','--remove','tcp:9222']).catch(()=>undefined);
  await Promise.race([browser?.close().catch(()=>undefined),new Promise((resolve)=>setTimeout(resolve,3000))]);
  report.status=fatal?'FAIL':'PASS';report.fatal=fatal;report.runtimeErrors=runtimeErrors;report.finishedAt=new Date().toISOString();
  report.revision=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
  await writeFile(path.join(out,'report.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');
}
console.log(`FINAL LANGUAGE WAVE ANDROID: ${report.status}`);console.log(path.join(out,'report.json'));if(fatal){console.error(fatal);process.exitCode=1;}

async function navigate(page,route,selector){await page.evaluate((value)=>{history.pushState({},'',value);dispatchEvent(new PopStateEvent('popstate'));},route);await page.waitForURL((url)=>url.pathname===route);await page.waitForSelector(selector);}
async function expectText(page,selector,expected,label){const text=await page.locator(selector).innerText();if(!text.toLocaleLowerCase().includes(expected.toLocaleLowerCase()))throw new Error(`${label}: expected ${JSON.stringify(expected)} in ${JSON.stringify(text.slice(0,800))}`);}
async function capture(page,language,surface,marker){if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))throw new Error(`${language}/${surface}: Android horizontal overflow`);await expectText(page,'body',marker,`${language}/${surface}: Android localized marker`);results.push({id:`${language}-android-${surface}`,status:'PASS',language,surface,capture:'CONTROLLED_WEBVIEW_DOM',marker});}
