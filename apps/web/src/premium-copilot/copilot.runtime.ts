import { PREMIUM_COPILOT_STATE, routeCopilotIntent, type CopilotDecision } from './copilot.contract';
import { copilotText as t } from './copilot.i18n';
import type { BasicLanguageCode } from '../language-registry';
import { CapabilityBroker } from '../premium-capabilities/capability.broker';
import { ActionConfirmationStore } from '../premium-capabilities/action-confirmation';
import { slice1Enabled, wave2bEnabled } from '../premium-capabilities/capability.registry';
import { SystemHandoffGateway } from '../premium-capabilities/system-handoff.gateway';
import { CommunicationHandoffGateway } from '../premium-capabilities/communication-handoff.gateway';
import { ProviderStatusLedger } from '../premium-capabilities/provider-status';
import { capabilityText } from '../premium-capabilities/capability.i18n';
import { ConversationalRoutingLedger, selectConversationalCapability } from '../premium-capabilities/conversational-routing';
import type { ActionPreview, CapabilityRequest, ConfirmationMethod } from '../premium-capabilities/capability.types';
import { verifiedPremiumSubject } from '../premium-access/premium-access.navigation';
import { launchAndroidAssistant, openAndroidAssistantSettings, shareWithAndroidAi } from '../premium-capabilities/android-assistant.gateway';

type State = {
  schemaVersion: 1;
  confirmedText: string;
  decision: CopilotDecision;
  safetyConfirmed?: boolean;
  updatedAt: string;
};

export function bindCopilotRuntime() {
  const root = document.querySelector<HTMLElement>('[data-premium-copilot]');
  if (!root) return;
  const runtimeRoot = root;
  const l = root.dataset.language as BasicLanguageCode;
  const transcript = root.querySelector<HTMLTextAreaElement>('[data-assistant-transcript]')!;
  const assistantButton=document.createElement('button');assistantButton.type='button';assistantButton.dataset.androidAssistant='';assistantButton.textContent='✨ AI Android';root.querySelector('[data-copilot-camera]')?.parentElement?.append(assistantButton);
  const shareAiButton=document.createElement('button');shareAiButton.type='button';shareAiButton.dataset.shareAndroidAi='';shareAiButton.textContent='↗ Întrebare către AI';assistantButton.after(shareAiButton);
  const assistantSettingsButton=document.createElement('button');assistantSettingsButton.type='button';assistantSettingsButton.dataset.androidAssistantSettings='';assistantSettingsButton.textContent='⚙ Setări AI';shareAiButton.after(assistantSettingsButton);
  const active = root.querySelector<HTMLElement>('[data-copilot-active]')!;
  const intent = root.querySelector<HTMLElement>('[data-copilot-intent]')!;
  const safety = root.querySelector<HTMLElement>('[data-copilot-safety]')!;
  const safeStop = root.querySelector<HTMLElement>('[data-copilot-safe-stop]')!;
  const ask = root.querySelector<HTMLButtonElement>('[data-assistant-confirm]')!;
  const diagnostic = root.querySelector<HTMLElement>('[data-copilot-diagnostic]')!;
  const previewRoot=root.querySelector<HTMLElement>('[data-capability-preview]')!;
  const previewTitle=root.querySelector<HTMLElement>('[data-capability-title]')!;
  const previewSummary=root.querySelector<HTMLElement>('[data-capability-summary]')!;
  const previewReceipt=root.querySelector<HTMLElement>('[data-capability-receipt]')!;
  const previewConfirm=root.querySelector<HTMLButtonElement>('[data-capability-confirm]')!;
  const previewCancel=root.querySelector<HTMLButtonElement>('[data-capability-cancel]')!;
  const broker=new CapabilityBroker();const confirmations=new ActionConfirmationStore();const gateway=new SystemHandoffGateway();const communicationGateway=new CommunicationHandoffGateway();const providerStatuses=new ProviderStatusLedger();const routingLedger=new ConversationalRoutingLedger();const conversationId='voice-current';let currentPreview:ActionPreview|undefined;let currentIntent:CopilotDecision['intent']='UNKNOWN';
  let observedTranscript=transcript.value.trim();
  previewTitle.textContent=capabilityText(l,'title');previewConfirm.textContent=capabilityText(l,'confirm');previewCancel.textContent=capabilityText(l,'cancel');

  const save = (state: State) => {
    sessionStorage.setItem(PREMIUM_COPILOT_STATE, JSON.stringify(state));
    diagnostic.textContent = `${state.decision.intent} · ${state.decision.capabilityId ?? 'clarification'} · ${state.updatedAt}`;
  };
  const render = (state: State) => {
    transcript.value = state.confirmedText;
    active.hidden = false;
    intent.textContent = state.decision.requiresClarification
      ? t(l, 'clarify')
      : `${state.decision.intent} · ${state.decision.capabilityId}`;
    safety.hidden = !state.decision.safetyGate;
    const unsafe = state.decision.safetyGate && state.safetyConfirmed === false;
    safeStop.hidden = !unsafe;
    transcript.disabled = unsafe;
    ask.hidden = state.decision.requiresClarification || (state.decision.safetyGate && state.safetyConfirmed !== true);
    if (state.decision.capabilityId && !['conversation', 'safety-guidance'].includes(state.decision.capabilityId)) {
      root.querySelector<HTMLElement>('[data-assistant-status]')!.textContent = t(l, 'notActive');
    }
  };

  root.querySelector('[data-copilot-route]')?.addEventListener('click', async () => {
    const confirmedText = transcript.value.trim();
    const state: State = {
      schemaVersion: 1,
      confirmedText,
      decision: routeCopilotIntent(confirmedText),
      updatedAt: new Date().toISOString(),
    };
    save(state);
    render(state);
    currentIntent=state.decision.intent;
    routingLedger.record({conversationId,intent:state.decision.intent,stage:'INTENT_IDENTIFIED',outcome:state.decision.confidence});
    if(slice1Enabled(sessionStorage)) await prepareCapability(state);
  });
  transcript.addEventListener('input',()=>{if(!currentPreview)return;confirmations.clear();currentPreview=undefined;delete previewRoot.dataset.confirmationId;previewRoot.hidden=true;previewReceipt.textContent='Preview invalidat după modificare. Pregătește acțiunea din nou.';});
  root.querySelector('[data-copilot-email]')?.addEventListener('click',()=>{if(!/email/i.test(transcript.value))transcript.value=`Email ${transcript.value}`.trim();root.querySelector<HTMLButtonElement>('[data-copilot-route]')?.click();});
  root.querySelector('[data-copilot-whatsapp]')?.addEventListener('click',()=>{if(!/whatsapp/i.test(transcript.value))transcript.value=`WhatsApp ${transcript.value}`.trim();root.querySelector<HTMLButtonElement>('[data-copilot-route]')?.click();});
  previewCancel.addEventListener('click',()=>{const preview=currentPreview;if(preview)routingLedger.record({conversationId,requestId:preview.requestId,intent:currentIntent,capabilityId:preview.capabilityId,stage:'CANCELLED',outcome:'USER_CANCELLED'});confirmations.clear();currentPreview=undefined;previewRoot.hidden=true;previewReceipt.textContent='';transcript.disabled=false;transcript.focus();routingLedger.record({conversationId,intent:currentIntent,stage:'CONVERSATION_RESUMED',outcome:'AFTER_CANCEL'});});
  previewConfirm.addEventListener('click',()=>void confirmAndOpen('TOUCH'));
  window.addEventListener('agma-capability-voice-confirm',(event)=>{const detail=(event as CustomEvent<{confirmationId?:string}>).detail;if(currentPreview&&detail?.confirmationId===currentPreview.confirmationId)void confirmAndOpen('VOICE');});
  if(slice1Enabled(sessionStorage))window.setInterval(()=>{const value=transcript.value.trim();if(!value||value===observedTranscript)return;observedTranscript=value;if(currentPreview&&isVoiceConfirmation(value,l)){void confirmAndOpen('VOICE');return;}if(!currentPreview){const decision=routeCopilotIntent(value);if(decision.intent==='PHONE'||decision.intent==='LOCATION'||(decision.intent==='COMMUNICATION'&&wave2bEnabled(sessionStorage)))void prepareCapability({schemaVersion:1,confirmedText:value,decision,updatedAt:new Date().toISOString()});}},300);
  root.querySelector('[data-safe="false"]')?.addEventListener('click', () => {
    const state = read();
    if (!state) return;
    state.safetyConfirmed = false;
    state.updatedAt = new Date().toISOString();
    save(state);
    render(state);
  });
  root.querySelector('[data-safe="true"]')?.addEventListener('click', () => {
    const state = read();
    if (!state) return;
    state.safetyConfirmed = true;
    state.updatedAt = new Date().toISOString();
    save(state);
    render(state);
  });
  root.querySelector('[data-copilot-text]')?.addEventListener('click', () => transcript.focus());
  root.querySelector('[data-copilot-camera]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('agm-android-assistant-handoff'));
    window.location.assign('/ocr');
  });
  assistantButton.addEventListener('click', async () => {
    window.dispatchEvent(new CustomEvent('agm-android-assistant-handoff'));
    const result = await launchAndroidAssistant();
    root.querySelector<HTMLElement>('[data-assistant-status]')!.textContent = result.status === 'OPENED' ? 'Asistentul Android a fost deschis.' : 'Asistentul Android nu este disponibil.';
  });
  shareAiButton.addEventListener('click', async () => {
    const text=transcript.value.trim();if(!text){root.querySelector<HTMLElement>('[data-assistant-status]')!.textContent='Scrieți sau dictați întâi întrebarea.';return;}
    window.dispatchEvent(new CustomEvent('agm-android-assistant-handoff'));
    await shareWithAndroidAi(text);
  });
  assistantSettingsButton.addEventListener('click', async () => { await openAndroidAssistantSettings(); });

  const restored = read();
  if (restored) render(restored);

  function read(): State | undefined {
    try {
      const value = JSON.parse(sessionStorage.getItem(PREMIUM_COPILOT_STATE) ?? 'null');
      return value?.schemaVersion === 1 ? value : undefined;
    } catch {
      return undefined;
    }
  }

  async function prepareCapability(state:State){
    const selection=selectConversationalCapability(state.decision,state.confirmedText,wave2bEnabled(sessionStorage));if(selection.status==='CONVERSATION_ONLY')return;if(selection.status==='DENIED'){routingLedger.record({conversationId,intent:state.decision.intent,stage:'DENIED',outcome:selection.reason});runtimeRoot.querySelector<HTMLElement>('[data-assistant-status]')!.textContent=capabilityText(l,'denied');return;}const capabilityId=selection.capabilityId;routingLedger.record({conversationId,intent:state.decision.intent,capabilityId,stage:'CAPABILITY_SELECTED',outcome:'ALLOWLIST_MATCH'});
    const subjectId=verifiedPremiumSubject('premium.voice-assistant');
    const request:CapabilityRequest={requestId:crypto.randomUUID(),conversationId,capabilityId,productId:'agm-cockpit',moduleId:'premium-copilot',tenantId:subjectId?`tenant:${subjectId}`:'',subjectId:subjectId??'',premiumEntitled:Boolean(subjectId),parameters:capabilityId==='OPEN_DIALER'?extractPhone(state.confirmedText):capabilityId==='OPEN_MAPS'?extractDestination(state.confirmedText):extractCommunication(state.confirmedText,capabilityId),requestedAt:new Date().toISOString()};
    const decision=await broker.prepare(request);if(decision.status==='NEEDS_INPUT'){runtimeRoot.querySelector<HTMLElement>('[data-assistant-status]')!.textContent=capabilityText(l,capabilityId==='OPEN_DIALER'?'needPhone':'needDestination');return;}if(decision.status==='DENIED'){runtimeRoot.querySelector<HTMLElement>('[data-assistant-status]')!.textContent=capabilityText(l,'denied');return;}
    currentPreview=decision.preview;confirmations.setPreview(currentPreview);routingLedger.record({conversationId,requestId:currentPreview.requestId,intent:state.decision.intent,capabilityId:currentPreview.capabilityId,stage:'PREVIEW_PRESENTED',outcome:'AWAITING_CONFIRMATION'});previewRoot.dataset.confirmationId=currentPreview.confirmationId;previewRoot.hidden=false;previewReceipt.textContent='';previewSummary.textContent=currentPreview.capabilityId==='OPEN_DIALER'?capabilityText(l,'dial',{name:currentPreview.recipient?.displayName||currentPreview.recipient!.address,value:currentPreview.recipient!.address}):currentPreview.capabilityId==='OPEN_MAPS'?capabilityText(l,'maps',{value:currentPreview.destination!}):`${currentPreview.actionType} → ${currentPreview.recipient!.address}\n${currentPreview.subject?`${currentPreview.subject}\n`:''}${currentPreview.body}`;
  }
  async function confirmAndOpen(method:ConfirmationMethod){const preview=currentPreview;if(!preview)return;if(preview.executionMode==='PROVIDER_HANDOFF'&&method!=='VOICE'){previewReceipt.textContent='Este necesară confirmarea verbală explicită.';return;}const result=confirmations.confirm({confirmationId:preview.confirmationId,previewVersion:preview.previewVersion,contentHash:preview.contentHash,method});if(result.status!=='CONFIRMED'){previewReceipt.textContent=capabilityText(l,'expired');return;}const confirmation=confirmations.consume(preview);if(!confirmation){previewReceipt.textContent=capabilityText(l,'expired');return;}previewConfirm.disabled=true;const receipt=preview.executionMode==='PROVIDER_HANDOFF'?await communicationGateway.open(preview,confirmation):await gateway.open(preview,confirmation);routingLedger.recordReceipt(conversationId,currentIntent,preview.capabilityId,preview.requestId,receipt);if(preview.executionMode==='PROVIDER_HANDOFF'){const provider=providerStatuses.recordHandoff(preview.requestId,receipt);previewReceipt.textContent=`Receipt ${receipt.receiptId}: ${provider.handoffStatus} · PROVIDER STATUS: ${provider.status}`;}else previewReceipt.textContent=`Receipt ${receipt.receiptId}: ${receipt.status} · ${receipt.handedOffAt}`;currentPreview=undefined;previewConfirm.disabled=false;transcript.disabled=false;routingLedger.record({conversationId,intent:currentIntent,stage:'CONVERSATION_RESUMED',outcome:'AFTER_HANDOFF'});}
}

function extractCommunication(text:string,capabilityId:'SEND_EMAIL'|'SEND_WHATSAPP'){const recipient=capabilityId==='SEND_EMAIL'?text.match(/[^\s:]+@[^\s:]+\.[^\s:]+/)?.[0]:text.match(/\+?[0-9][0-9 ()-]{4,24}/)?.[0]?.trim();const marker=recipient?text.indexOf(recipient)+recipient.length:-1;const body=(marker>=0?text.slice(marker):text).replace(/^\s*[:,-]?\s*/,'').trim();return{recipient,subject:capabilityId==='SEND_EMAIL'?'Mesaj AGM':'',body:body||undefined};}

function extractPhone(text:string){const match=text.match(/\+?[0-9][0-9 ()-]{4,24}/);const withoutNumber=match?text.replace(match[0],''):text;const name=withoutNumber.replace(/\b(sun[aă]|apel|telefon|call|anrufen|pe|pentru|for|für)\b/gi,' ').replace(/\s+/g,' ').trim();return{phoneNumber:match?.[0].trim(),displayName:name||undefined};}
function extractDestination(text:string){const cleaned=text.replace(/\b(deschide|naviga(?:ție|tia)|maps|hart[aă]|route|navigation|karte|către|catre|spre|to|nach)\b/gi,' ').replace(/\s+/g,' ').trim();return{destination:cleaned||undefined,grounded:true};}
function isVoiceConfirmation(value:string,language:BasicLanguageCode){const normalized=value.toLocaleLowerCase().trim().replace(/[.!?]/g,'');const phrases:Record<BasicLanguageCode,string[]>={ro:['da','confirm','confirmă'],de:['ja','bestätigen','bestätige'],en:['yes','confirm'],fr:['oui','confirmer'],nl:['ja','bevestigen'],ru:['да','подтвердить'],pl:['tak','potwierdź'],tr:['evet','onayla'],sq:['po','konfirmo']};return phrases[language].includes(normalized);}
