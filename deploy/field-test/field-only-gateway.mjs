import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import http from 'node:http';

const port=Number(process.env.FIELD_GATEWAY_PORT??3301);
const upstream=new URL(process.env.FIELD_UPSTREAM_URL??'http://api:3000');
const jwtSecret=required('JWT_SECRET');
const identities=JSON.parse(required('FIELD_IDENTITIES_JSON'));
const allowedOrigins=new Set(JSON.parse(process.env.FIELD_ALLOWED_ORIGINS_JSON??'[]'));
const routes=new Map([
  ['GET /api/v1/car-mover/routing/field-protocol','PROTOCOL'],
  ['POST /api/v1/car-mover/routing/observations','OBSERVATION'],
  ['GET /api/v1/car-mover/routing/telemetry','TELEMETRY'],
]);
const rate=new Map();

const server=http.createServer(async(request,response)=>{
  response.setHeader('X-AGM-Environment','FIELD-VALIDATION');
  response.setHeader('Cache-Control','no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  const url=new URL(request.url??'/',upstream);
  const operation=routes.get(`${request.method} ${url.pathname}`);
  if(request.method==='OPTIONS'&&[...routes.keys()].some((key)=>key.endsWith(` ${url.pathname}`)))return preflight(request,response);
  if(!operation)return send(response,404,{error:'FIELD_ENDPOINT_NOT_EXPOSED'});
  if(!originAllowed(request))return send(response,403,{error:'FIELD_ORIGIN_NOT_ALLOWED'});
  const identity=authenticate(request.headers.authorization);
  if(!identity)return send(response,401,{error:'FIELD_TESTER_AUTHORIZATION_REQUIRED'});
  if(!authorized(identity.access,operation))return send(response,403,{error:'FIELD_OPERATION_NOT_AUTHORIZED'});
  if(rateLimited(identity.id))return send(response,429,{error:'FIELD_RATE_LIMIT'});
  try{
    const body=await readBody(request);
    const headers={'Authorization':`Bearer ${jwt(identity)}`,'Content-Type':'application/json','X-AGM-Field-Tester':identity.id,'X-Request-Id':String(request.headers['x-request-id']??randomUUID())};
    const target=new URL(`${url.pathname}${url.search}`,upstream);
    const result=await fetch(target,{method:request.method,headers,body:request.method==='GET'?undefined:body});
    response.statusCode=result.status;
    response.setHeader('Content-Type',result.headers.get('content-type')??'application/json');
    cors(request,response);
    response.end(Buffer.from(await result.arrayBuffer()));
  }catch(error){send(response,502,{error:'FIELD_UPSTREAM_UNAVAILABLE',detail:error instanceof Error?error.name:'UnknownError'});}
});

server.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'FIELD_GATEWAY_READY',port,upstream:upstream.origin,exposedRoutes:[...routes.keys()]})));

function authenticate(header){
  if(!header?.startsWith('Bearer '))return null;
  const digest=createHash('sha256').update(header.slice(7)).digest();
  return identities.find((item)=>{const expected=Buffer.from(item.tokenHash,'hex');return expected.length===digest.length&&timingSafeEqual(expected,digest);})??null;
}
function authorized(access,operation){return access==='TESTER'?operation==='PROTOCOL'||operation==='OBSERVATION':access==='OWNER'?operation==='PROTOCOL'||operation==='TELEMETRY':false;}
function jwt(identity){
  const roles=identity.access==='OWNER'?['OWNER','PREMIUM_ACCESS']:['PREMIUM_ACCESS'];
  const now=Math.floor(Date.now()/1000),header=encode({alg:'HS256',typ:'JWT'}),payload=encode({sub:identity.userId,companyId:identity.companyId,roles,scope:'user',iat:now,exp:now+300});
  return`${header}.${payload}.${createHmac('sha256',jwtSecret).update(`${header}.${payload}`).digest('base64url')}`;
}
function encode(value){return Buffer.from(JSON.stringify(value)).toString('base64url');}
function rateLimited(id){const minute=Math.floor(Date.now()/60_000),key=`${id}:${minute}`,count=(rate.get(key)??0)+1;rate.set(key,count);if(rate.size>500)for(const item of rate.keys())if(!item.endsWith(`:${minute}`))rate.delete(item);return count>120;}
function originAllowed(request){const origin=request.headers.origin;return!origin||allowedOrigins.has(origin);}
function cors(request,response){const origin=request.headers.origin;if(origin&&allowedOrigins.has(origin)){response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');}}
function preflight(request,response){if(!originAllowed(request))return send(response,403,{error:'FIELD_ORIGIN_NOT_ALLOWED'});cors(request,response);response.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Request-Id');response.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');response.statusCode=204;response.end();}
function send(response,status,body){response.statusCode=status;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(body));}
async function readBody(request){const chunks=[];let length=0;for await(const chunk of request){length+=chunk.length;if(length>64*1024)throw new Error('PAYLOAD_TOO_LARGE');chunks.push(chunk);}return Buffer.concat(chunks);}
function required(key){const value=process.env[key];if(!value)throw new Error(`${key}_REQUIRED`);return value;}
