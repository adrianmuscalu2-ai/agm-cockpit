import { createWorker } from 'tesseract.js';
import { basicLanguageRegistry, isBasicLanguageCode, type BasicLanguageCode } from '../language-registry';
import { classifyDocumentExpiry, createOperationalCase, transitionOperationalCase } from './operational-case.machine';
import { OPERATIONAL_CASE_STORAGE_KEY, restoreOperationalCase, saveOperationalCase } from './operational-case.persistence';
import { requiredDocumentCopy } from './required-document.i18n';
import type { OperationalCase } from './situation-router.types';
import { preserveOriginal, restoreVerifiedOriginal, sha256 } from './required-document.evidence-store';
import { applyRequiredDocumentSyncResult, enqueueRequiredDocumentTransition, flushRequiredDocumentTransitions } from './required-document.sync';

const FLAG = 'agm.premium.situation-router.enabled';
const escapeHtml = (value:string) => value.replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

class RequiredDocumentElement extends HTMLElement {
  private value!: OperationalCase;
  private file?: File;
  private diagnosticsOpen=false;
  private readonly reconnect=()=>void this.flushSync();
  connectedCallback() {
    if (sessionStorage.getItem(FLAG) === 'false') { this.hidden = true; return; }
    document.documentElement.classList.add('situation-router-enabled');
    const languageValue = sessionStorage.getItem('agm.premium.language') ?? 'ro';
    const language:BasicLanguageCode = isBasicLanguageCode(languageValue) ? languageValue : 'ro';
    const restored = restoreOperationalCase(sessionStorage);
    this.value = restored?.situationId === 'required-document' ? restored : createOperationalCase(crypto.randomUUID(),'required-document',language);
    window.addEventListener('online',this.reconnect);
    this.render();
  }
  disconnectedCallback(){window.removeEventListener('online',this.reconnect);}
  private commit(next:OperationalCase) {
    this.value={...next,data:{...next.data,syncStatus:'SYNC_PENDING'}};
    saveOperationalCase(sessionStorage,this.value);this.render();
    void enqueueRequiredDocumentTransition(sessionStorage,this.value,navigator.onLine).then(()=>{if(navigator.onLine)void this.flushSync();}).catch(()=>this.localStatus('SYNC_PENDING'));
  }
  private localStatus(syncStatus:string){this.value={...this.value,data:{...this.value.data,syncStatus}};saveOperationalCase(sessionStorage,this.value);this.render();}
  private async flushSync(){
    this.localStatus('RECONNECTING');
    const result=await flushRequiredDocumentTransitions({storage:sessionStorage,value:this.value});
    this.value=applyRequiredDocumentSyncResult(this.value,result);saveOperationalCase(sessionStorage,this.value);this.render();
  }
  private set(values:Record<string,unknown>) { this.commit(transitionOperationalCase(this.value,{type:'SET_DATA',values})); }
  private render() {
    const selectedLanguage=sessionStorage.getItem('agm.premium.language');
    const displayLanguage:BasicLanguageCode=isBasicLanguageCode(selectedLanguage)?selectedLanguage:this.value.language;
    const c=requiredDocumentCopy[displayLanguage]; const d=this.value.data;
    const hasOriginal=this.value.evidence.some((e)=>e.kind==='original');
    const hasStarted=typeof d.documentType==='string'&&d.documentType.length>0;
    const confirmed=d.textConfirmed===true;
    const expiry=typeof d.validUntil==='string'?classifyDocumentExpiry(d.validUntil):'INVALID';
    const valid=d.readable===true&&expiry!=='EXPIRED'&&expiry!=='INVALID';
    const warning=expiry==='WARNING';
    const resolved=this.value.state==='RESOLVED';
    const recovery=this.value.state==='RECOVERY_REQUIRED';
    const blocking=recovery||d.available===false||d.severity==='blocking'||(confirmed&&!valid);
    const recoveryMessage=d.recoveryReason==='ORIGINAL_MISSING'?c.originalMissing:d.recoveryReason==='ORIGINAL_HASH_MISMATCH'?c.originalChanged:c.recoveryRequired;
    const uiMessage=d.flowStatus==='OCR_STARTED'?c.ocrStarted:d.flowError==='OCR_FAILED'?c.ocrFailed:d.flowError==='OCR_UNAVAILABLE'?c.ocrUnavailable:d.flowError==='CAMERA_DENIED'?c.cameraDenied:d.flowError==='CAMERA_UNAVAILABLE'?c.cameraUnavailable:d.flowError==='INVALID_IMPORT'?c.invalidImport:d.flowError==='UNSUPPORTED_FILE'?c.unsupportedFile:d.flowError==='INDEXEDDB_UNAVAILABLE'?c.storageFailed:d.syncStatus==='RECOVERY_REQUIRED'?c.syncConflict:'';
    this.innerHTML=`<section class="pre-departure-card required-document-flow" data-required-document>
      <header><p class="pre-departure-kicker">${escapeHtml(c.title)}</p><button type="button" data-recovery>⋯ ${escapeHtml(c.recovery)}</button></header>
      <label>${escapeHtml(c.applicable)}<select data-field="documentType"><option value="" ${d.documentType?'':'selected'}>${escapeHtml(c.select)}</option><option value="cmr" ${d.documentType==='cmr'?'selected':''}>${c.cmr}</option><option value="license" ${d.documentType==='license'?'selected':''}>${c.license}</option><option value="adr" ${d.documentType==='adr'?'selected':''}>${c.adr}</option></select></label>
      ${d.documentType?`<fieldset><legend>${escapeHtml(c.available)}</legend><button data-available="true">${c.yes}</button><button class="secondary" data-available="false">${c.no}</button></fieldset>`:''}
      ${d.available===true?`<div><label class="pre-departure-action-link">${c.capture}<input hidden data-file data-source="camera" type="file" accept="image/*" capture="environment"></label> <label class="pre-departure-action-link">${c.import}<input hidden data-file data-source="import" type="file" accept="image/*,.pdf"></label></div>`:''}
      ${hasOriginal?`<p class="pre-departure-ready">${c.original}</p><button data-ocr>${c.runOcr}</button>`:''}
      ${typeof d.ocrText==='string'?`<label>${c.ocr}<textarea data-ocr-text>${escapeHtml(String(confirmed?(d.confirmedText??d.ocrText):d.ocrText))}</textarea></label><label>${c.confirmer}<input data-confirmer value="${escapeHtml(String(d.confirmedBy??''))}" autocomplete="name"></label><label><input data-confirm type="checkbox" ${confirmed?'checked':''}> ${c.confirmText}</label>`:''}
      ${confirmed?`<fieldset><label><input data-check="readable" type="checkbox" ${d.readable?'checked':''}> ${c.readable}</label><label>${c.validUntil}<input data-field="validUntil" type="date" value="${escapeHtml(String(d.validUntil??''))}"></label>${warning?`<p class="pre-departure-offline">${c.expiryWarning}</p><label><input data-check="warningConfirmed" type="checkbox" ${d.warningConfirmed?'checked':''}> ${c.warningConfirm}</label>`:''}${expiry==='EXPIRED'?`<p class="pre-departure-offline">${c.expired}</p>`:''}<label>${c.severity}<select data-field="severity"><option value="warning">${c.warning}</option><option value="blocking" ${d.severity==='blocking'?'selected':''}>${c.blocking}</option></select></label><label>${c.remediation}<input data-field="remediation" value="${escapeHtml(String(d.remediation??''))}"></label></fieldset>`:''}
      ${hasStarted||recovery?`<p role="status" class="${blocking?'pre-departure-offline':'pre-departure-ready'}">${recovery?recoveryMessage:blocking?c.blocked:resolved?'READY &#10003;':c.ready}</p>`:''}
      ${uiMessage?`<p role="status" class="pre-departure-offline">${escapeHtml(uiMessage)}</p>`:''}
      <button data-ready ${!resolved&&confirmed&&valid&&!blocking&&(!warning||d.warningConfirmed===true)?'':'disabled'}>${resolved?'READY &#10003;':c.confirmReady}</button>${d.syncStatus==='SYNC_PENDING'?`<small role="status">${c.syncPending}</small>`:d.syncStatus==='RECONNECTING'?`<small role="status">${c.reconnecting}</small>`:navigator.onLine?'':`<small role="status">${c.offline}</small>`}
      ${this.diagnosticsOpen?`<details open><summary>${escapeHtml(c.recovery)}</summary><code>${escapeHtml(OPERATIONAL_CASE_STORAGE_KEY)}</code><p>${escapeHtml(c.diagnosticsRevision)}: ${this.value.revision}</p></details>`:''}
    </section>`;
    this.querySelectorAll<HTMLSelectElement|HTMLInputElement>('[data-field]').forEach(el=>el.addEventListener('change',()=>this.set({[el.dataset.field!]:el.value})));
    this.querySelectorAll<HTMLButtonElement>('[data-available]').forEach(el=>el.addEventListener('click',()=>this.set({available:el.dataset.available==='true'})));
    this.querySelectorAll<HTMLInputElement>('[data-file]').forEach(el=>{el.addEventListener('click',async(event)=>{if(el.dataset.source!=='camera')return;if(!navigator.mediaDevices){event.preventDefault();this.set({flowError:'CAMERA_UNAVAILABLE'});return;}try{const permission=await (navigator.permissions as Permissions&{query(input:{name:string}):Promise<PermissionStatus>}).query({name:'camera'});if(permission.state==='denied'){event.preventDefault();this.set({flowError:'CAMERA_DENIED'});}}catch{/* Browserul va aplica propriul prompt de permisiune. */}});el.addEventListener('error',()=>this.set({flowError:el.dataset.source==='camera'?'CAMERA_DENIED':'INVALID_IMPORT'}));el.addEventListener('change',async()=>{ const file=el.files?.[0]; if(!file)return; if(file.size===0){this.set({flowError:'INVALID_IMPORT'});return;}if(!file.type.startsWith('image/')&&file.type!=='application/pdf'){this.set({flowError:'UNSUPPORTED_FILE'});return;} this.file=file; try { const id=await sha256(file); await preserveOriginal(id,file); this.commit(transitionOperationalCase(this.value,{type:'ADD_EVIDENCE',evidence:{id,sha256:id,kind:'original'}})); } catch { let next=transitionOperationalCase(this.value,{type:'REQUIRE_RECOVERY',reason:'ORIGINAL_STORAGE_FAILED'});next=transitionOperationalCase(next,{type:'SET_DATA',values:{flowError:'INDEXEDDB_UNAVAILABLE'}});this.commit(next); } });});
    this.querySelector<HTMLButtonElement>('[data-ocr]')?.addEventListener('click',async()=>{const originalEvidence=this.value.evidence.find(e=>e.kind==='original');if(!originalEvidence)return;if(typeof Worker==='undefined'){this.set({flowError:'OCR_UNAVAILABLE'});return;}this.set({flowStatus:'OCR_STARTED',flowError:null}); const verified=await restoreVerifiedOriginal(originalEvidence.id,originalEvidence.sha256);if(!verified.ok){let next=transitionOperationalCase(this.value,{type:'REQUIRE_RECOVERY',reason:verified.reason});next=transitionOperationalCase(next,{type:'SET_DATA',values:{flowStatus:null}});this.commit(next);return;} let worker:Awaited<ReturnType<typeof createWorker>>|undefined; try { worker=await createWorker(basicLanguageRegistry[displayLanguage].ocrCode); const result=await worker.recognize(verified.blob); const initialText=result.data.text; let next=transitionOperationalCase(this.value,{type:'ADD_EVIDENCE',evidence:{id:crypto.randomUUID(),sha256:await sha256(new Blob([initialText])),kind:'ocr-proposal',sourceId:originalEvidence.id,sourceSha256:originalEvidence.sha256,initialText}}); next=transitionOperationalCase(next,{type:'SET_DATA',values:{ocrInitialText:initialText,ocrText:initialText,flowStatus:null,flowError:null}}); this.commit(next); } catch { this.set({flowStatus:null,flowError:'OCR_FAILED'}); } finally { await worker?.terminate(); }});
    this.querySelector<HTMLInputElement>('[data-confirm]')?.addEventListener('change',async e=>{const checked=(e.target as HTMLInputElement).checked;const confirmedText=this.querySelector<HTMLTextAreaElement>('[data-ocr-text]')?.value??'';const confirmedBy=this.querySelector<HTMLInputElement>('[data-confirmer]')?.value.trim()??'';if(!checked||!confirmedBy)return;const ocr=this.value.evidence.find(evidence=>evidence.kind==='ocr-proposal');if(!ocr)return;let next=transitionOperationalCase(this.value,{type:'ADD_EVIDENCE',evidence:{id:crypto.randomUUID(),sha256:await sha256(new Blob([confirmedText])),kind:'human-confirmation',sourceId:ocr.id,sourceSha256:ocr.sha256,confirmedText,confirmedAt:new Date().toISOString(),confirmedBy}});next=transitionOperationalCase(next,{type:'SET_DATA',values:{textConfirmed:true,confirmedText,confirmedBy}});this.commit(next);});
    this.querySelectorAll<HTMLInputElement>('[data-check]').forEach(el=>el.addEventListener('change',()=>this.set({[el.dataset.check!]:el.checked})));
    this.querySelector<HTMLButtonElement>('[data-ready]')?.addEventListener('click',()=>this.commit(transitionOperationalCase(this.value,{type:'CONFIRM_READY'})));
    this.querySelector<HTMLButtonElement>('[data-recovery]')?.addEventListener('click',()=>{this.diagnosticsOpen=!this.diagnosticsOpen;this.render();});
  }
}
customElements.define('agm-required-document',RequiredDocumentElement);
