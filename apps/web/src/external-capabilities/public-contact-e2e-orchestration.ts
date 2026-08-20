import { ConversationalPublicWebUse, type PublicWebFact, type PublicWebRetriever } from './conversational-public-web-use';
import { PublicContactControlledAction, type ContactActionResult, type VerifiedPublicContact } from './public-contact-controlled-action';

export type PublicContactE2EState=
 | Readonly<{phase:'IDLE'}>
 | Readonly<{phase:'CONTACT_READY';contact:VerifiedPublicContact;facts:readonly PublicWebFact[];options:readonly string[]}>
 | Readonly<{phase:'ACTION_PREVIEW';contact:VerifiedPublicContact;action:ContactActionResult}>
 | Readonly<{phase:'RETURNED_TO_CONVERSATION';contact:VerifiedPublicContact;action:ContactActionResult}>
 | Readonly<{phase:'STOPPED';reason:string}>;

export class PublicContactE2EOrchestration{
 private state:PublicContactE2EState={phase:'IDLE'};private readonly web=new ConversationalPublicWebUse();private readonly actions=new PublicContactControlledAction();get snapshot(){return this.state;}
 async search(request:string,retrieve:PublicWebRetriever):Promise<PublicContactE2EState>{const result=await this.web.answer(request,retrieve);if(result.status!=='GROUNDED')return this.state={phase:'STOPPED',reason:result.status};const entity=new Set(result.sources.map(f=>f.entity));if(entity.size!==1)return this.state={phase:'STOPPED',reason:'AMBIGUOUS_CONTACT'};const contact:VerifiedPublicContact={contactId:crypto.randomUUID(),entity:result.sources[0].entity,phone:result.sources.find(f=>f.kind==='PHONE')?.value,address:result.sources.find(f=>f.kind==='ADDRESS')?.value,sourceUrl:result.sources[0].url,navigationReceiptId:result.receiptIds[0]??'',verified:true};const options=['COPY_PHONE',...(contact.phone?['PREPARE_CALL','PREPARE_MESSAGE']:[]),...(contact.address?['OPEN_MAPS']:[])];return this.state={phase:'CONTACT_READY',contact,facts:result.sources,options:Object.freeze(options)};}
 copy(){if(this.state.phase!=='CONTACT_READY')return this.stop('VERIFIED_CONTACT_REQUIRED');const contact=this.state.contact,action=this.actions.copy(contact);return this.state=action.status==='COPIED'?{phase:'RETURNED_TO_CONVERSATION',contact,action}:{phase:'STOPPED',reason:action.reason};}
 async propose(kind:'CALL'|'MAP'|'MESSAGE',message?:string){if(this.state.phase!=='CONTACT_READY')return this.stop('VERIFIED_CONTACT_REQUIRED');const contact=this.state.contact,action=await this.actions.propose(contact,kind,message);return this.state=action.status==='PREVIEW'?{phase:'ACTION_PREVIEW',contact,action}:{phase:'STOPPED',reason:action.reason};}
 confirm(confirmed:boolean){if(this.state.phase!=='ACTION_PREVIEW'||!this.state.action.preview)return this.stop('ACTION_PREVIEW_REQUIRED');const contact=this.state.contact,action=this.actions.handoff(contact,this.state.action.preview,confirmed);return this.state=action.status==='HANDOFF'?{phase:'RETURNED_TO_CONVERSATION',contact,action}:{phase:'STOPPED',reason:action.reason};}
 cancel(){if(this.state.phase!=='CONTACT_READY'&&this.state.phase!=='ACTION_PREVIEW')return this.stop('NO_ACTIVE_CONTACT_ACTION');const contact=this.state.contact,action=this.actions.cancel(contact);return this.state={phase:'RETURNED_TO_CONVERSATION',contact,action};}
 private stop(reason:string):PublicContactE2EState{return this.state={phase:'STOPPED',reason};}
}
