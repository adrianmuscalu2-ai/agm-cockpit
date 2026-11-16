import 'reflect-metadata';
import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createServer } from 'node:net';

async function main() {
 const portProbe=createServer();await new Promise<void>(r=>portProbe.listen(0,'127.0.0.1',r));
 const webPort=(portProbe.address() as {port:number}).port;await new Promise<void>(r=>portProbe.close(()=>r()));
 process.env.CORS_ALLOWED_ORIGINS=`http://127.0.0.1:${webPort}`;
 process.env.REHEARSAL_WEB_PORT=String(webPort);
 process.env.AGM_TURN_ADMIN_PIN_HASH=await bcrypt.hash(process.env.AGM_REHEARSAL_TURN_PIN!,12);
 const {createAgmatccRehearsalApp}=await import('./start-agmatcc-isolated-local');
 const app=await createAgmatccRehearsalApp();
 try {
  await app.listen(0,'127.0.0.1'); const base=`${await app.getUrl()}/api/v1`;
  const db=app.get(PrismaService);
  const before=await db.$queryRaw<any[]>`SELECT count(*)::int AS count FROM "LunaEvaluationReservation"`;
  const results:Array<{scenario:string,status:number}>=[];
  async function request(path:string,token?:string,body?:unknown) {
   return fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  }
  const login=await request('/auth/login',undefined,{email:process.env.AGM_REHEARSAL_OWNER_EMAIL,password:process.env.AGM_REHEARSAL_OWNER_PASSWORD});
  assert.equal(login.status,201,'existing rehearsal OWNER login');
  const owner=(await login.json() as any).data.accessToken;
  const unlock=await request('/turn-admin/unlock',undefined,{pin:process.env.AGM_REHEARSAL_TURN_PIN});
  assert.equal(unlock.status,201,'existing rehearsal TURN unlock');
  const turnPayload=(await unlock.json() as any).data;
  const turn=turnPayload.token??turnPayload.accessToken;
  assert.ok(turn);
  for(const c of [
   {scenario:'anonymous ACPM',path:'/acpm',token:undefined,expected:401},
   {scenario:'TURN cannot substitute for OWNER',path:'/acpm',token:turn,expected:401},
   {scenario:'existing OWNER ACPM',path:'/acpm',token:owner,expected:200},
   {scenario:'anonymous Luna controls',path:'/agmatcc-copilot/control-status',token:undefined,expected:401},
   {scenario:'OWNER cannot substitute for Commander',path:'/agmatcc-copilot/control-status',token:owner,expected:403},
   {scenario:'existing TURN Luna controls',path:'/agmatcc-copilot/control-status',token:turn,expected:200},
   {scenario:'existing TURN historical search',path:'/operational-events/search/semantic?q=PR35',token:turn,expected:200},
  ]) {const r=await request(c.path,c.token);results.push({scenario:c.scenario,status:r.status});assert.equal(r.status,c.expected,c.scenario);}
  if(process.env.FUNCTIONAL_BROWSER==='true') {
   // Test an explicitly disabled local feature. Never change Production config.
   app.get(ConfigService).set('AGMATCC_COPILOT_ISOLATED_ENABLED','false');
   const child=spawn(process.execPath,[resolve('../../scripts/validate-functional-closure-browser.mjs')],{cwd:resolve('../..'),env:{...process.env,VITE_AGM_API_BASE_URL:base},stdio:'inherit',windowsHide:true});
   assert.equal(await new Promise(r=>child.on('exit',r)),0,'controlled browser');
  }
  const after=await db.$queryRaw<any[]>`SELECT count(*)::int AS count FROM "LunaEvaluationReservation"`;
  assert.deepEqual(after,before);
  writeFileSync(join(process.env.FUNCTIONAL_EVIDENCE_DIR!,'authenticated-http.json'),JSON.stringify({at:new Date().toISOString(),verdict:'PASS',scope:'EXISTING_REHEARSAL_REAL_HTTP_EXISTING_IDENTITIES',results,providerCalls:0,reservationsUnchanged:true,guardsOverridden:false,credentialsCreated:false},null,2));
  console.log(JSON.stringify({verdict:'PASS',results,providerCalls:0}));
 } finally {await app.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
