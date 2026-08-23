import type { CommunicationChannel, InboundCommunication, OutboundCommunication } from './communication.contract';
export type ProviderSendResult={providerMessageId:string;externalThreadId?:string;status:'sent'|'queued'};
export interface CommunicationProviderPort { readonly channel:CommunicationChannel; readonly provider:string; configured():boolean; send(message:OutboundCommunication):Promise<ProviderSendResult>; readRecent?():Promise<InboundCommunication[]>; }
export class CommunicationProviderRegistry {
  constructor(private readonly providers:readonly CommunicationProviderPort[]){}
  for(channel:CommunicationChannel){const provider=this.providers.find((item)=>item.channel===channel);if(!provider||!provider.configured())throw new Error(`COMMUNICATION_PROVIDER_NOT_CONFIGURED:${channel}`);return provider;}
  status(){return this.providers.map((provider)=>({channel:provider.channel,provider:provider.provider,configured:provider.configured()}));}
}
