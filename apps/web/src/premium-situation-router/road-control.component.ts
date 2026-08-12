import { isBasicLanguageCode, type BasicLanguageCode } from '../language-registry';
import { createOperationalCase, transitionOperationalCase } from './operational-case.machine';
import { preserveOriginal, sha256 } from './required-document.evidence-store';
import { roadControlCopy } from './road-control.i18n';
import type { OperationalCase } from './situation-router.types';
import { applyRoadControlSyncResult, enqueueRoadControlTransition, flushRoadControlTransitions } from './road-control.sync';

const FLAG='agm.premium.situation-router.enabled';
const KEY='agm.premium.operational-case.v1:road-control';
const LANG='agm.premium.language';
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

function restore():OperationalCase|null{try{const raw=localStorage.getItem(KEY);if(!raw)return null;const value=JSON.parse(raw) as OperationalCase;return value.schemaVersion===1&&value.situationId==='road-control'?value:null;}catch{return null;}}

class RoadControlElement extends HTMLElement{
 private value!:OperationalCase;
 private onlineHandler=()=>void this.flushPending();
 connectedCallback(){
  if(localStorage.getItem(FLAG)==='false'){this.hidden=true;return;}
  document.documentElement.classList.add('road-control-router-enabled');
  const selected=localStorage.getItem(LANG);const language:BasicLanguageCode=isBasicLanguageCode(selected)?selected:'ro';
  this.value=restore()??createOperationalCase(crypto.randomUUID(),'road-control',language);
  window.addEventListener('online',this.onlineHandler);
  this.render();
  if(navigator.onLine)void this.flushPending();
 }
 disconnectedCallback(){window.removeEventListener('online',this.onlineHandler);}
 private commit(next:OperationalCase){this.value={...next,data:{...next.data,syncStatus:'SYNC_PENDING'}};localStorage.setItem(KEY,JSON.stringify(this.value));this.render();void enqueueRoadControlTransition(localStorage,this.value,navigator.onLine).then(()=>{if(navigator.onLine)return this.flushPending();}).catch(()=>undefined);}
 private async flushPending(){const result=await flushRoadControlTransitions({storage:localStorage}).catch(()=>({status:'offline' as const}));this.value=applyRoadControlSyncResult(this.value,result);localStorage.setItem(KEY,JSON.stringify(this.value));this.render();}
 private set(values:Record<string,unknown>){this.commit(transitionOperationalCase(this.value,{type:'SET_DATA',values}));}
 private render(){
  const selected=localStorage.getItem(LANG);const language:BasicLanguageCode=isBasicLanguageCode(selected)?selected:this.value.language;const c=roadControlCopy[language];const d=this.value.data;
  const safe=d.safeToInteract===true;const unsafe=d.safeToInteract===false;const stopped=d.safelyStopped===true;const request=String(d.requestType??'');
  const original=this.value.evidence.find(item=>item.kind==='original');const ocr=this.value.evidence.find(item=>item.kind==='ocr-proposal');const confirmed=this.value.evidence.find(item=>item.kind==='human-confirmation');
  const effect=this.value.externalEffects.at(-1);const disposition=['RESOLVED','FOLLOW_UP_REQUIRED','ESCALATED'].includes(this.value.state)?this.value.state:null;
  this.innerHTML=`<section class="after-departure-panel road-control-flow" data-road-control>
   <header class="road-control-title"><h2>${escapeHtml(c.title)}</h2><button type="button" data-reset class="secondary">${escapeHtml(c.reset)}</button></header>
   <label class="field"><span class="visually-hidden">Language</span><select data-language>${(Object.keys(roadControlCopy) as BasicLanguageCode[]).map(code=>`<option value="${code}" ${code===language?'selected':''}>${code.toUpperCase()}</option>`).join('')}</select></label>
   <fieldset><legend>${escapeHtml(c.safetyQuestion)}</legend><div class="choice-row"><button type="button" data-safe="true">${escapeHtml(c.yes)}</button><button type="button" data-safe="false" class="secondary">${escapeHtml(c.no)}</button></div></fieldset>
   ${unsafe?`<aside class="offline-banner" role="alert">${escapeHtml(c.unsafe)} <a href="tel:112">112</a></aside>`:''}
   ${safe&&!stopped?`<fieldset><legend>${escapeHtml(c.safeStop)}</legend><button type="button" data-safe-stop>${escapeHtml(c.confirmStop)}</button></fieldset>`:''}
   ${stopped?`<fieldset><legend>${escapeHtml(c.request)}</legend><div class="choice-row"><button type="button" data-request="document">${escapeHtml(c.document)}</button><button type="button" data-request="information">${escapeHtml(c.information)}</button><button type="button" data-request="other">${escapeHtml(c.other)}</button></div></fieldset>`:''}
   ${stopped&&request?`<section data-active-request><h3>${escapeHtml(c.evidence)}</h3>
    ${request==='document'?`<div class="choice-row"><label class="after-departure-file">${escapeHtml(c.camera)}<input data-file type="file" accept="image/*" capture="environment"></label><label class="after-departure-file">${escapeHtml(c.import)}<input data-file type="file" accept="image/*,.pdf"></label></div>
    ${original?`<label class="field">${escapeHtml(c.ocrText)}<textarea data-ocr-text>${escapeHtml(String(d.ocrText??''))}</textarea></label><button type="button" data-ocr-proposal ${ocr?'disabled':''}>OCR</button>`:''}
    ${ocr?`<label class="field">${escapeHtml(c.operator)}<input data-operator value="${escapeHtml(String(d.confirmedBy??''))}"></label><label><input data-human-review type="checkbox" ${confirmed?'checked disabled':''}> ${escapeHtml(c.confirmText)}</label>`:''}`:''}
    ${request!=='document'||confirmed?`<label class="field">${escapeHtml(c.translation)}<textarea data-value="translation">${escapeHtml(String(d.translation??''))}</textarea></label>
    <label class="field">${escapeHtml(c.notes)}<textarea data-value="notes">${escapeHtml(String(d.notes??''))}</textarea></label>
    <fieldset><legend>${escapeHtml(c.communication)}</legend><div class="choice-row"><button type="button" data-channel="email">${escapeHtml(c.email)}</button><button type="button" data-channel="whatsapp">${escapeHtml(c.whatsapp)}</button></div><p>${escapeHtml(c.noSend)}</p>${d.channel?`<button type="button" data-prepare ${effect?'disabled':''}>${escapeHtml(c.prepare)}</button>`:''}${effect?.phase==='PREPARED'?`<button type="button" data-confirm-external>${escapeHtml(c.humanConfirm)}</button><p role="status">${escapeHtml(c.prepared)}</p>`:''}</fieldset>
    <div class="action-row"><button type="button" data-disposition="RESOLVED">${escapeHtml(c.resolve)}</button><button type="button" data-disposition="FOLLOW_UP_REQUIRED" class="secondary">${escapeHtml(c.followUp)}</button><button type="button" data-disposition="ESCALATED" class="secondary">${escapeHtml(c.escalate)}</button></div>`:''}
   </section>`:''}
   <footer><strong>${escapeHtml(c.status)}: ${escapeHtml(disposition??this.value.state)}</strong>${d.syncStatus==='SYNC_PENDING'?`<p role="status">${escapeHtml(c.offline)}</p>`:''}</footer>
  </section>`;
  this.querySelector<HTMLSelectElement>('[data-language]')?.addEventListener('change',e=>{localStorage.setItem(LANG,(e.target as HTMLSelectElement).value);this.render();});
  this.querySelectorAll<HTMLButtonElement>('[data-safe]').forEach(button=>button.addEventListener('click',()=>this.commit(transitionOperationalCase(this.value,{type:'CONFIRM_SAFE_INTERACTION',safe:button.dataset.safe==='true'}))));
  this.querySelector<HTMLButtonElement>('[data-safe-stop]')?.addEventListener('click',()=>this.commit(transitionOperationalCase(this.value,{type:'CONFIRM_SAFE_STOP'})));
  this.querySelectorAll<HTMLButtonElement>('[data-request]').forEach(button=>button.addEventListener('click',()=>this.set({requestType:button.dataset.request,qualifiedAt:new Date().toISOString()})));
  this.querySelectorAll<HTMLTextAreaElement>('[data-value]').forEach(input=>input.addEventListener('change',()=>this.set({[input.dataset.value!]:input.value})));
  this.querySelectorAll<HTMLButtonElement>('[data-channel]').forEach(button=>button.addEventListener('click',()=>this.set({channel:button.dataset.channel})));
  this.querySelectorAll<HTMLInputElement>('[data-file]').forEach(input=>input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{const id=await sha256(file);await preserveOriginal(id,file);this.commit(transitionOperationalCase(this.value,{type:'ADD_EVIDENCE',evidence:{id,sha256:id,kind:'original'}}));}catch{this.commit(transitionOperationalCase(this.value,{type:'REQUIRE_RECOVERY',reason:'ORIGINAL_STORAGE_FAILED'}));}}));
  this.querySelector<HTMLButtonElement>('[data-ocr-proposal]')?.addEventListener('click',async()=>{const text=this.querySelector<HTMLTextAreaElement>('[data-ocr-text]')?.value.trim()??'';if(!original||!text)return;const id=crypto.randomUUID();this.commit(transitionOperationalCase(this.value,{type:'ADD_EVIDENCE',evidence:{id,sha256:await sha256(new Blob([text])),kind:'ocr-proposal',sourceId:original.id,sourceSha256:original.sha256,initialText:text}}));this.set({ocrText:text});});
  this.querySelector<HTMLInputElement>('[data-human-review]')?.addEventListener('change',async e=>{if(!(e.target as HTMLInputElement).checked||!ocr)return;const text=String(d.ocrText??ocr.initialText??'');const operator=this.querySelector<HTMLInputElement>('[data-operator]')?.value.trim()??'';if(!text||!operator)return;let next=transitionOperationalCase(this.value,{type:'ADD_EVIDENCE',evidence:{id:crypto.randomUUID(),sha256:await sha256(new Blob([text])),kind:'human-confirmation',sourceId:ocr.id,sourceSha256:ocr.sha256,confirmedText:text,confirmedAt:new Date().toISOString(),confirmedBy:operator}});next=transitionOperationalCase(next,{type:'SET_DATA',values:{textConfirmed:true,confirmedBy:operator}});this.commit(next);});
  this.querySelector<HTMLButtonElement>('[data-prepare]')?.addEventListener('click',()=>{const operationId=`road-control:${this.value.id}:${String(d.channel)}`;this.commit(transitionOperationalCase(this.value,{type:'PREPARE_EXTERNAL',effect:{operationId,channel:d.channel as 'email'|'whatsapp'}}));});
  this.querySelector<HTMLButtonElement>('[data-confirm-external]')?.addEventListener('click',()=>{if(effect)this.commit(transitionOperationalCase(this.value,{type:'CONFIRM_EXTERNAL',operationId:effect.operationId}));});
  this.querySelectorAll<HTMLButtonElement>('[data-disposition]').forEach(button=>button.addEventListener('click',()=>this.commit(transitionOperationalCase(this.value,{type:'SET_DISPOSITION',disposition:button.dataset.disposition as 'RESOLVED'|'FOLLOW_UP_REQUIRED'|'ESCALATED'}))));
  this.querySelector<HTMLButtonElement>('[data-reset]')?.addEventListener('click',()=>{this.value=createOperationalCase(crypto.randomUUID(),'road-control',language);localStorage.setItem(KEY,JSON.stringify(this.value));this.render();});
 }
}
customElements.define('agm-road-control',RoadControlElement);
