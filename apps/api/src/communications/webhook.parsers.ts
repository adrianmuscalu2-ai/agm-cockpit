import { createHmac,timingSafeEqual } from 'crypto';
import type { InboundCommunication,CommunicationStatus } from './communication.contract';

type WhatsAppWebhook = {
 entry?: Array<{changes?: Array<{value?: {
  metadata?: {display_phone_number?:string;phone_number_id?:string};
  contacts?: Array<{profile?:{name?:string}}>;
  messages?: Array<{id:string;type:string;from:string;timestamp:string;text?:{body?:string}}>;
  statuses?: Array<{id:string;status:string;timestamp:string}>;
 }}>}>;
};
type ParsedStatus={providerMessageId:string;status:CommunicationStatus;occurredAt:string;providerEventId:string};
type GmailPushBody={message?:{data?:string;messageId?:string;publishTime?:string}};

export function verifyHmacSha256(raw:Buffer,signature:string|undefined,secret:string){if(!signature?.startsWith('sha256='))return false;const expected=createHmac('sha256',secret).update(raw).digest('hex');const supplied=signature.slice(7);return supplied.length===expected.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));}
export function parseWhatsAppWebhook(body:unknown):{inbound:InboundCommunication[];statuses:ParsedStatus[]}{
 const payload=body as WhatsAppWebhook;const inbound:InboundCommunication[]=[];const statuses:ParsedStatus[]=[];for(const entry of payload.entry??[])for(const change of entry.changes??[]){const value=change.value??{};for(const m of value.messages??[]){if(m.type!=='text')continue;inbound.push({contractVersion:'communication-message.v1',provider:'whatsapp-cloud',providerEventId:`message:${m.id}`,providerMessageId:m.id,channel:'whatsapp',from:m.from,to:value.metadata?.display_phone_number??value.metadata?.phone_number_id??'',bodyText:m.text?.body??'',occurredAt:new Date(Number(m.timestamp)*1000).toISOString(),metadata:{contactName:value.contacts?.[0]?.profile?.name}});}for(const s of value.statuses??[]){if(!isCommunicationStatus(s.status))continue;statuses.push({providerMessageId:s.id,status:s.status,occurredAt:new Date(Number(s.timestamp)*1000).toISOString(),providerEventId:`status:${s.id}:${s.status}:${s.timestamp}`});}}
 return{inbound,statuses};
}
export function parseGmailPush(body:unknown){const message=(body as GmailPushBody).message;const encoded=message?.data;if(typeof encoded!=='string'||!message?.messageId)throw new Error('GMAIL_PUSH_INVALID');const value=JSON.parse(Buffer.from(encoded,'base64').toString('utf8')) as {emailAddress?:string;historyId?:string};if(!value.emailAddress||!value.historyId)throw new Error('GMAIL_PUSH_INVALID');return{providerEventId:`gmail-push:${message.messageId}`,emailAddress:value.emailAddress,historyId:value.historyId,publishedAt:message.publishTime};}
function isCommunicationStatus(value:string):value is CommunicationStatus{return ['sent','delivered','read','failed'].includes(value);}
