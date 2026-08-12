export const communicationChannels = ['email','whatsapp'] as const;
export type CommunicationChannel = typeof communicationChannels[number];
export const communicationDirections = ['inbound','outbound'] as const;
export type CommunicationDirection = typeof communicationDirections[number];
export const communicationStatuses = ['received','queued','sending','sent','delivered','read','failed','conflict'] as const;
export type CommunicationStatus = typeof communicationStatuses[number];

export type OutboundCommunication = {
  contractVersion:'communication-message.v1'; clientMessageId:string; channel:CommunicationChannel;
  to:string; subject?:string; bodyText:string; tripId?:string; replyToProviderMessageId?:string;
};
export type InboundCommunication = {
  contractVersion:'communication-message.v1'; provider:string; providerEventId:string; providerMessageId:string;
  externalThreadId?:string; channel:CommunicationChannel; from:string; to:string; subject?:string;
  bodyText:string; occurredAt:string; metadata?:Record<string,unknown>;
};

export function normalizeAddress(channel:CommunicationChannel,value:string) {
  const clean=value.trim();
  if(channel==='email') return clean.toLowerCase();
  return clean.replace(/[^+\d]/g,'');
}
export function validateOutbound(value:unknown):OutboundCommunication {
  const v=value as Partial<OutboundCommunication>;
  if(v?.contractVersion!=='communication-message.v1'||!communicationChannels.includes(v.channel as CommunicationChannel)||!uuid(v.clientMessageId)||!v.to?.trim()||!v.bodyText?.trim()||v.bodyText.length>20_000) throw new Error('COMMUNICATION_OUTBOUND_INVALID');
  const to=normalizeAddress(v.channel as CommunicationChannel,v.to);
  if(v.channel==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('COMMUNICATION_EMAIL_INVALID');
  if(v.channel==='whatsapp'&&!/^\+?\d{8,15}$/.test(to)) throw new Error('COMMUNICATION_WHATSAPP_INVALID');
  return {...v,to,bodyText:v.bodyText.trim()} as OutboundCommunication;
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value:unknown):value is string{return typeof value==='string'&&UUID.test(value);}
