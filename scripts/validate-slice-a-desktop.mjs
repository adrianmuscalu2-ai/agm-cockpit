import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(root,'evidence','slice-a','desktop',runId);
const target='http://127.0.0.1:5174/';
const route=new URL('/before-departure.html',target).toString();
const storageKey='agm.premium.operational-case.v1';
const flagKey='agm.premium.situation-router.enabled';
const results=[]; const logs=[];
const requested=new Set((process.env.AGM_SLICE_A_SCENARIOS??'A,B,H,K,L,O').split(',').map(v=>v.trim().toUpperCase()).filter(Boolean));
let server=null; let browser=null;
const log=(event,detail={})=>logs.push({at:new Date().toISOString(),event,...detail});
const sha=async(file)=>createHash('sha256').update(await readFile(file)).digest('hex').toUpperCase();
const caseValue=(id,state,data,evidence=[],language='ro')=>({schemaVersion:1,id,situationId:'required-document',definitionVersion:1,language,state,activeStep:'ready-verdict',completedSteps:['identify-document','document-availability','capture-original','ocr-review','document-check','remediation'],data,evidence,externalEffects:[],revision:8,updatedAt:new Date().toISOString()});
const chain=(edited='CMR confirmat')=>[
  {id:'original-1',kind:'original',sha256:'ORIGINAL-SHA256'},
  {id:'ocr-1',kind:'ocr-proposal',sha256:'OCR-SHA256',sourceId:'original-1',sourceSha256:'ORIGINAL-SHA256',initialText:'CMR initial'},
  {id:'confirm-1',kind:'human-confirmation',sha256:'CONFIRMED-SHA256',sourceId:'ocr-1',sourceSha256:'OCR-SHA256',confirmedText:edited,confirmedAt:new Date().toISOString(),confirmedBy:'desktop-validator'},
];

async function ready(){try{return (await fetch(target)).status===200;}catch{return false;}}
async function startTarget(){
  if(await ready()){log('target-reused',{target});return;}
  const command='node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port 5174 --strictPort';
  server=spawn(process.env.ComSpec||'cmd.exe',['/d','/s','/c',command],{cwd:path.join(root,'apps','web'),windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',d=>log('web-stdout',{message:d.toString().trim()}));
  server.stderr.on('data',d=>log('web-stderr',{message:d.toString().trim()}));
  for(let i=0;i<80;i+=1){if(await ready()){log('target-started',{target,pid:server.pid});return;}await new Promise(r=>setTimeout(r,250));}
  throw new Error('AGM Cockpit did not answer HTTP 200 on strict port 5174. Existing processes were not stopped.');
}
async function seed(page,value,{flag=true,language='ro'}={}){
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.evaluate(({storageKey,flagKey,value,flag,language})=>{
    localStorage.setItem(flagKey,String(flag));
    localStorage.setItem('agm.premium.language',language);
    if(value)localStorage.setItem(storageKey,JSON.stringify(value)); else localStorage.removeItem(storageKey);
  },{storageKey,flagKey,value,flag,language});
  await page.goto(route,{waitUntil:'networkidle'});
}
async function scenario(page,id,run){
  const started=new Date().toISOString(); let status='FAIL',detail=''; let screenshot=null;
  try{detail=await run(); screenshot=path.join(out,`scenario-${id.toLowerCase()}.png`);await page.screenshot({path:screenshot,fullPage:true});status='PASS';}
  catch(error){detail=error instanceof Error?error.message:String(error); screenshot=path.join(out,`scenario-${id.toLowerCase()}-fail.png`);await page.screenshot({path:screenshot,fullPage:true}).catch(()=>{});}
  const result={scenario:id,status,startedAt:started,finishedAt:new Date().toISOString(),url:page.url(),screenshot:path.relative(root,screenshot),detail};
  results.push(result);log('scenario-result',result);if(status==='FAIL')throw new Error(`${id}: ${detail}`);
}
async function runScenario(page,id,run){if(!requested.has(id))return;await scenario(page,id,run);}
const expect=async(condition,message)=>{if(!condition)throw new Error(message);};

await mkdir(out,{recursive:true});
let fatal=null;
try{
  await startTarget();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ro-RO'});
  let page=await context.newPage();
  page.on('console',m=>log('browser-console',{type:m.type(),message:m.text()}));
  page.on('pageerror',e=>log('browser-pageerror',{message:e.message}));

  await runScenario(page,'A',async()=>{const v=caseValue('desktop-a','RESOLVED',{documentType:'cmr',available:true,ocrInitialText:'CMR initial',ocrText:'CMR initial',textConfirmed:true,confirmedText:'CMR confirmat',confirmedBy:'desktop-validator',readable:true,validUntil:'2027-12-31',severity:'warning',readyConfirmed:true},chain());await seed(page,v);await expect(await page.locator('[data-ready]').innerText()==='READY ✓','READY terminal control not rendered');await expect(await page.locator('[data-ready]').isDisabled(),'READY terminal control was not disabled');return 'present/readable/valid renders terminal READY';});
  await runScenario(page,'B',async()=>{const v=caseValue('desktop-b','BLOCKED',{documentType:'cmr',available:false,severity:'blocking'});await seed(page,v);const text=await page.locator('[data-required-document]').innerText();await expect(text.includes('Plecare blocată'),'blocked verdict not rendered');await expect(await page.locator('[data-ready]').isDisabled(),'READY incorrectly enabled');return 'missing document renders blocked verdict and disabled READY';});
  await runScenario(page,'H',async()=>{const edited='CMR editat și confirmat';const v=caseValue('desktop-h','REVIEW_REQUIRED',{documentType:'cmr',available:true,ocrInitialText:'CMR initial',ocrText:'CMR initial',textConfirmed:true,confirmedText:edited,confirmedBy:'desktop-validator',readable:true,validUntil:'2027-12-31',severity:'warning'},chain(edited));await seed(page,v);await expect((await page.locator('[data-ocr-text]').inputValue())===edited,'edited confirmed text not rendered');const saved=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),storageKey));await expect(saved.data.ocrInitialText==='CMR initial','initial OCR overwritten');await expect(saved.evidence[2].sourceId==='ocr-1'&&saved.evidence[1].sourceId==='original-1','provenance chain broken');return 'edited text visible; initial OCR and original->OCR->confirmation provenance preserved';});
  await runScenario(page,'K',async()=>{const v=caseValue('desktop-k','REVIEW_REQUIRED',{documentType:'license',available:true,ocrInitialText:'Licence',ocrText:'Licence',textConfirmed:true,confirmedText:'Licence confirmată',confirmedBy:'desktop-validator',readable:true,validUntil:'2027-12-31',severity:'warning'},chain('Licence confirmată'));await seed(page,v);await page.reload({waitUntil:'networkidle'});await expect((await page.locator('[data-field="documentType"]').inputValue())==='license','state lost after first reload');await page.goto('about:blank');await page.goto(route,{waitUntil:'networkidle'});await expect((await page.locator('[data-field="documentType"]').inputValue())==='license','state lost after controlled page restart');return 'reload and controlled page restart preserved selected document and confirmed case';});
  await runScenario(page,'L',async()=>{const v=caseValue('desktop-l','REVIEW_REQUIRED',{documentType:'cmr',available:true,ocrInitialText:'CMR',ocrText:'CMR',textConfirmed:true,confirmedText:'CMR',confirmedBy:'desktop-validator',readable:true,validUntil:'2027-12-31',severity:'warning'},chain('CMR'));await seed(page,v);const before=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),storageKey));await page.evaluate(()=>localStorage.setItem('agm.premium.language','sq'));await page.reload({waitUntil:'networkidle'});const after=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),storageKey));await expect(after.id===before.id&&after.revision===before.revision,'language change modified operational state');const visible=(await page.locator('[data-required-document]').innerText()).toLocaleLowerCase('sq');await expect(visible.includes('dokument i detyruesh'),'Albanian UI not rendered');return 'RO->SQ preserved case identity/revision and rendered localized UI';});
  await runScenario(page,'O',async()=>{const v=caseValue('desktop-o','RECOVERY_REQUIRED',{documentType:'cmr',recoveryReason:'ORIGINAL_MISSING'});await seed(page,v,{flag:false});await expect(await page.locator('agm-required-document').isHidden(),'router projection remained visible with feature flag off');await expect((await page.locator('[data-e6-entry="before-departure"]').count())===1,'legacy projection missing');await page.evaluate(()=>localStorage.setItem('agm.premium.situation-router.enabled','true'));await page.reload({waitUntil:'networkidle'});await expect(await page.locator('[data-required-document]').isVisible(),'router did not reactivate');const restored=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),storageKey));await expect(restored.id==='desktop-o'&&restored.state==='RECOVERY_REQUIRED','reactivation lost or remigrated case');return 'feature flag rollback shows legacy projection; reactivation restores identical recovery case';});
  await page.close();
}catch(error){fatal=error instanceof Error?error.message:String(error);log('fatal',{message:fatal});}
finally{
  await browser?.close();
  if(server)spawnSync('taskkill.exe',['/pid',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  const gitCommit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
  const gitStatus=spawnSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).stdout.trim();
  const report={schemaVersion:1,runId,status:fatal?'FAIL':'PASS',startedAt:logs[0]?.at??new Date().toISOString(),finishedAt:new Date().toISOString(),runner:'Controlled AGM Playwright/Chromium',chromiumVersion:browser?.version?.()??'closed',target,route,requestedScenarios:[...requested],build:{gitCommit,workingTree:gitStatus?'dirty':'clean',manifest:path.relative(root,path.join(root,'evidence','slice-a','EVIDENCE_MANIFEST.json')),manifestSha256:await sha(path.join(root,'evidence','slice-a','EVIDENCE_MANIFEST.json'))},iab:{status:'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',blocking:false,proof:'Browser is not available: iab; discovered backends []'},results,requirements:{screenshotsComplete:results.length===requested.size&&results.every(r=>r.screenshot),machineReadableReport:true,noFabricatedPass:results.length===requested.size&&results.every(r=>r.status==='PASS')},fatal};
  await writeFile(path.join(out,'runner.log.jsonl'),logs.map(v=>JSON.stringify(v)).join('\n')+'\n','utf8');
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
  console.log(`SLICE A DESKTOP CONTROLLED BROWSER: ${report.status}`);console.log(path.join(out,'report.json'));
  if(fatal)process.exitCode=1;
}
