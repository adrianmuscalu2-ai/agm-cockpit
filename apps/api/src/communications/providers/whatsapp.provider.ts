import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CommunicationProviderPort, ProviderSendResult } from '../communication-provider.port';
import type { OutboundCommunication } from '../communication.contract';
@Injectable()
export class WhatsAppCommunicationProvider implements CommunicationProviderPort{
  readonly channel='whatsapp' as const;readonly provider='whatsapp-cloud';
  constructor(private readonly config:ConfigService){}
  configured(){return Boolean(this.config.get<string>('WHATSAPP_ACCESS_TOKEN')&&this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'));}
  async send(message:OutboundCommunication):Promise<ProviderSendResult>{
    if(!this.configured())throw new Error('COMMUNICATION_PROVIDER_NOT_CONFIGURED:whatsapp');
    const version=this.config.get<string>('WHATSAPP_GRAPH_VERSION','v23.0');const phoneId=this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    const response=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`,{method:'POST',headers:{authorization:`Bearer ${this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN')}`,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:message.to.replace(/^\+/,''),type:'text',text:{preview_url:false,body:message.bodyText}})});
    if(!response.ok)throw new Error(`WHATSAPP_SEND_FAILED:${response.status}`);const body=await response.json() as {messages?:Array<{id:string}>};const id=body.messages?.[0]?.id;if(!id)throw new Error('WHATSAPP_SEND_INVALID_RESPONSE');return{providerMessageId:id,status:'sent'};
  }
}
