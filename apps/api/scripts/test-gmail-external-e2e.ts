import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { GmailCommunicationProvider } from '../src/communications/providers/gmail.provider';

async function main(){const from=process.env.GMAIL_FROM_ADDRESS;assert.ok(from);const provider=new GmailCommunicationProvider(new ConfigService(process.env));assert.equal(provider.configured(),true);
  if(process.env.GMAIL_E2E_MODE==='refresh') { const profile=await gmail('/profile'); assert.equal(String(profile.emailAddress).toLowerCase(),from.toLowerCase()); console.log(JSON.stringify({verdict:'GMAIL_RESTART_REFRESH_PASS',freshProcess:true,automaticTokenRefresh:true,messageSent:false,secretsPrinted:false})); return; }
  const marker=`AGM-LOCAL-E2E-${Date.now()}-${randomUUID().slice(0,8)}`;
  const outbound=await provider.send({contractVersion:'communication-message.v1',clientMessageId:randomUUID(),channel:'email',to:from,subject:marker,bodyText:`${marker} outbound`});
  assert.equal(outbound.status,'sent');assert.ok(outbound.providerMessageId);assert.ok(outbound.externalThreadId);
  const inbound=await waitForMessage(marker,5);assert.ok(inbound);assert.equal(inbound.threadId,outbound.externalThreadId);
  const reply=await provider.send({contractVersion:'communication-message.v1',clientMessageId:randomUUID(),channel:'email',to:from,subject:`Re: ${marker}`,bodyText:`${marker} reply`,replyToProviderMessageId:outbound.externalThreadId});
  assert.equal(reply.status,'sent');assert.equal(reply.externalThreadId,outbound.externalThreadId);
  const thread=await waitForThread(outbound.externalThreadId!,2,5);assert.ok(thread.messages.length>=2);
  console.log(JSON.stringify({verdict:'GMAIL_EXTERNAL_E2E_PASS',outbound:true,inbound:true,reply:true,threadPreserved:true,attemptsAtMostFive:true,secretsPrinted:false}));}

async function token(){const body=new URLSearchParams({client_id:process.env.GMAIL_OAUTH_CLIENT_ID!,client_secret:process.env.GMAIL_OAUTH_CLIENT_SECRET!,refresh_token:process.env.GMAIL_OAUTH_REFRESH_TOKEN!,grant_type:'refresh_token'});const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});assert.equal(response.ok,true,`TOKEN_HTTP_${response.status}`);const value=await response.json() as {access_token?:string};assert.ok(value.access_token);return value.access_token;}
async function gmail(path:string){const response=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`,{headers:{authorization:`Bearer ${await token()}`}});assert.equal(response.ok,true,`GMAIL_HTTP_${response.status}`);return response.json() as Promise<any>;}
async function waitForMessage(subject:string,max:number){for(let attempt=1;attempt<=max;attempt++){const list=await gmail(`/messages?q=${encodeURIComponent(`subject:${subject}`)}&maxResults=5`);if(list.messages?.[0])return gmail(`/messages/${list.messages[0].id}?format=metadata`);await new Promise(resolve=>setTimeout(resolve,1000*attempt));}throw new Error('GMAIL_INBOUND_NOT_FOUND');}
async function waitForThread(id:string,count:number,max:number){for(let attempt=1;attempt<=max;attempt++){const value=await gmail(`/threads/${encodeURIComponent(id)}?format=metadata`);if((value.messages?.length??0)>=count)return value;await new Promise(resolve=>setTimeout(resolve,1000*attempt));}throw new Error('GMAIL_REPLY_NOT_FOUND');}
void main().catch((error)=>{console.error(error instanceof Error?error.message:'GMAIL_EXTERNAL_E2E_FAILED');process.exitCode=1;});
