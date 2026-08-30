import { createHash, createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const root=path.resolve(import.meta.dirname,'..');
const gatewayPort=await freePort(),upstreamPort=await freePort(),secret='field-test-jwt-secret-with-more-than-32-characters';
const testerToken='tester-token',ownerToken='owner-token',companyId='f1000000-0000-4000-8000-000000000001';
const identities=[
  {id:'FIELD-TESTER-01',access:'TESTER',userId:'f3000000-0000-4000-8000-000000000001',companyId,tokenHash:hash(testerToken)},
  {id:'FIELD-OWNER',access:'OWNER',userId:'f3000000-0000-4000-8000-00000000000f',companyId,tokenHash:hash(ownerToken)},
];
const upstreamRequests=[];
const upstream=http.createServer((request,response)=>{const body=[];request.on('data',(chunk)=>body.push(chunk));request.on('end',()=>{upstreamRequests.push({url:request.url,method:request.method,authorization:request.headers.authorization,body:Buffer.concat(body).toString()});response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ok:true}));});});
await listen(upstream,upstreamPort);
const gateway=spawn(process.execPath,[path.join(root,'deploy/field-test/field-only-gateway.mjs')],{cwd:root,env:{...process.env,FIELD_GATEWAY_PORT:String(gatewayPort),FIELD_UPSTREAM_URL:`http://127.0.0.1:${upstreamPort}`,JWT_SECRET:secret,FIELD_IDENTITIES_JSON:JSON.stringify(identities),FIELD_ALLOWED_ORIGINS_JSON:'["capacitor://localhost"]'},stdio:['ignore','pipe','pipe']});
let stderr='';gateway.stderr.on('data',(chunk)=>stderr+=chunk);
try{
  await waitReady(gatewayPort);
  await expectStatus('/api/v1/car-mover/routing/field-protocol',401);
  await expectStatus('/api/v1/health/ready',404,{token:testerToken});
  await expectStatus('/api/v1/car-mover/routing/field-protocol',200,{token:testerToken});
  await expectStatus('/api/v1/car-mover/routing/telemetry',403,{token:testerToken});
  await expectStatus('/api/v1/car-mover/routing/observations',403,{token:ownerToken,method:'POST',body:'{}'});
  await expectStatus('/api/v1/car-mover/routing/telemetry',200,{token:ownerToken});
  await expectStatus('/api/v1/car-mover/routing/field-protocol',403,{token:testerToken,origin:'https://untrusted.invalid'});
  assert(upstreamRequests.length===2,'UPSTREAM_REQUEST_COUNT_INVALID');
  for(const request of upstreamRequests){assert(request.authorization?.startsWith('Bearer '),'INTERNAL_JWT_MISSING');assert(!request.authorization.includes(testerToken)&&!request.authorization.includes(ownerToken),'FIELD_TOKEN_FORWARDED');const payload=verifyJwt(request.authorization.slice(7),secret);const expectedRoles=request.url?.endsWith('/telemetry')?['OWNER','PREMIUM_ACCESS']:['PREMIUM_ACCESS'];assert(JSON.stringify(payload.roles)===JSON.stringify(expectedRoles),'INTERNAL_JWT_ROLES_INVALID');}
  console.log('FIELD_ONLY_GATEWAY_TEST=PASS');
  console.log('EXPOSED_OPERATIONS=TESTER_PROTOCOL,TESTER_OBSERVATION,OWNER_PROTOCOL,OWNER_TELEMETRY');
  console.log('BLOCKED_NON_FIELD_PATH=PASS');
  console.log('FIELD_TOKEN_NOT_FORWARDED=PASS');
  console.log('INTERNAL_ROLE_MAPPING=PASS');
}finally{gateway.kill();upstream.close();}

async function expectStatus(route,status,{token,method='GET',body,origin}={}){const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(origin)headers.Origin=origin;if(body)headers['Content-Type']='application/json';const response=await fetch(`http://127.0.0.1:${gatewayPort}${route}`,{method,headers,body});assert(response.status===status,`${method}_${route}_EXPECTED_${status}_GOT_${response.status}`);}
function verifyJwt(token,key){const parts=token.split('.');assert(parts.length===3,'JWT_PARTS_INVALID');const expected=createHmac('sha256',key).update(`${parts[0]}.${parts[1]}`).digest('base64url');assert(expected===parts[2],'JWT_SIGNATURE_INVALID');const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());assert(payload.scope==='user'&&payload.exp>Math.floor(Date.now()/1000),'JWT_PAYLOAD_INVALID');return payload;}
function hash(value){return createHash('sha256').update(value).digest('hex');}
function assert(value,message){if(!value)throw new Error(message);}
async function freePort(){return await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(()=>resolve(address.port));});});}
async function listen(server,port){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}
async function waitReady(port){for(let attempt=0;attempt<50;attempt++){try{await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`);return;}catch{await new Promise((resolve)=>setTimeout(resolve,50));}}throw new Error(`GATEWAY_START_TIMEOUT ${stderr}`);}
