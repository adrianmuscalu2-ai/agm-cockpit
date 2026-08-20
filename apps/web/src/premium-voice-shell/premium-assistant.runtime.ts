import { basicLanguageRegistry, isBasicLanguageCode } from '../language-registry';
import { isNativeAudioAvailable, NativeAudio } from '../native-audio';
import { createPremiumAssistantClient, PremiumAssistantClientError } from './premium-assistant.client';
import { premiumAssistantUiMessages } from './premium-assistant-ui.i18n';
import { enforceVerifiedContactBoundary } from './premium-assistant-grounding';
import { VoiceSessionController, type VoiceSessionState } from './voice-session';
import { isPremiumNavigationAllowed } from '../premium-access/premium-access.navigation';
import { detectPremiumConversationIntent, type PremiumConversationActionProposal } from './premium-conversation.contract';
import { premiumConversationMessages } from './premium-conversation.i18n';

type Recognition = { lang:string;interimResults:boolean;continuous:boolean;onresult:((event:any)=>void)|null;onerror:((event:any)=>void)|null;onend:(()=>void)|null;start():void;stop():void };
type RecognitionConstructor = new()=>Recognition;
type HistoryTurn={role:'user'|'assistant';text:string};
const HISTORY_KEY='agm.premium.assistant.history.v1';
const TELEMETRY_KEY='agm.premium.voice.telemetry.v1';

const stateText:Record<string,Record<'OFF'|'LISTENING'|'SPEECH_DETECTED'|'PROCESSING'|'SPEAKING',string>>={
 ro:{OFF:'Ascultare oprită',LISTENING:'Ascult',SPEECH_DETECTED:'Te aud',PROCESSING:'Procesez',SPEAKING:'Vorbesc'},
 de:{OFF:'Zuhören aus',LISTENING:'Ich höre zu',SPEECH_DETECTED:'Ich höre Sie',PROCESSING:'Verarbeitung',SPEAKING:'Ich spreche'},
 en:{OFF:'Listening off',LISTENING:'Listening',SPEECH_DETECTED:'I hear you',PROCESSING:'Processing',SPEAKING:'Speaking'},
 fr:{OFF:'Écoute désactivée',LISTENING:'J’écoute',SPEECH_DETECTED:'Je vous entends',PROCESSING:'Traitement',SPEAKING:'Je parle'},
 nl:{OFF:'Luisteren uit',LISTENING:'Ik luister',SPEECH_DETECTED:'Ik hoor u',PROCESSING:'Verwerken',SPEAKING:'Ik spreek'},
 ru:{OFF:'Прослушивание выключено',LISTENING:'Слушаю',SPEECH_DETECTED:'Я вас слышу',PROCESSING:'Обработка',SPEAKING:'Говорю'},
 pl:{OFF:'Nasłuchiwanie wyłączone',LISTENING:'Słucham',SPEECH_DETECTED:'Słyszę cię',PROCESSING:'Przetwarzam',SPEAKING:'Mówię'},
 tr:{OFF:'Dinleme kapalı',LISTENING:'Dinliyorum',SPEECH_DETECTED:'Sizi duyuyorum',PROCESSING:'İşliyorum',SPEAKING:'Konuşuyorum'},
 sq:{OFF:'Dëgjimi joaktiv',LISTENING:'Po dëgjoj',SPEECH_DETECTED:'Po ju dëgjoj',PROCESSING:'Po përpunoj',SPEAKING:'Po flas'},
};

export function bindPremiumAssistantRuntime(){
 const root=document.querySelector<HTMLElement>('[data-premium-assistant], [data-premium-copilot]');if(!root)return;
 const runtimeRoot=root;
 const language=isBasicLanguageCode(root.dataset.language)?root.dataset.language:'en';const m=premiumAssistantUiMessages[language];
 const transcript=root.querySelector<HTMLTextAreaElement>('[data-assistant-transcript]')!;const status=root.querySelector<HTMLElement>('[data-assistant-status]')!;
 const toggle=root.querySelector<HTMLButtonElement>('[data-assistant-start]')!;const stop=root.querySelector<HTMLButtonElement>('[data-assistant-stop]')!;
 const panel=root.querySelector<HTMLElement>('[data-assistant-response-panel]')!;const response=root.querySelector<HTMLElement>('[data-assistant-response]')!;
 const latency=root.querySelector<HTMLElement>('[data-assistant-latency]');const settings=root.querySelector<HTMLButtonElement>('[data-assistant-open-settings]');
 const retry=root.querySelector<HTMLButtonElement>('[data-assistant-retry]');let retryText='';
 const historyPanel=root.querySelector<HTMLElement>('[data-assistant-history-panel]')!;const historyList=root.querySelector<HTMLOListElement>('[data-assistant-history]')!;
 const actionPanel=root.querySelector<HTMLElement>('[data-assistant-action-panel]')!;const actionSummary=root.querySelector<HTMLElement>('[data-assistant-action-summary]')!;let pendingAction:PremiumConversationActionProposal|undefined;
 const env=(import.meta as ImportMeta&{env?:Record<string,string|boolean|undefined>}).env;const configured=typeof env?.VITE_AGM_API_BASE_URL==='string'?env.VITE_AGM_API_BASE_URL.trim():'';const apiBase=configured||(env?.DEV===true?'/api/v1':'');
 const client=createPremiumAssistantClient({apiBaseUrl:apiBase,fetch:window.fetch.bind(window),sessionStorage});const history=loadHistory();let answerText='';let activeRequest:AbortController|undefined;let requestSequence=0;let recognition:Recognition|undefined;
 const session=new VoiceSessionController(renderState);renderHistory();renderState('OFF');

 toggle.addEventListener('click',()=>void handleMicrophoneToggle());
 stop.addEventListener('click',()=>void turnOff());
 root.querySelector('[data-assistant-cancel]')?.addEventListener('click',()=>{transcript.value='';void turnOff();});
 root.querySelector('[data-assistant-confirm]')?.addEventListener('click',()=>void processTranscript(transcript.value.trim(),false));
 root.querySelector('[data-assistant-replay]')?.addEventListener('click',()=>void speak(answerText));
 root.querySelector('[data-assistant-stop-playback]')?.addEventListener('click',()=>void stopSpeaking());
 root.querySelector('[data-assistant-action-confirm]')?.addEventListener('click',()=>confirmPendingAction());
 root.querySelector('[data-assistant-action-reject]')?.addEventListener('click',()=>rejectPendingAction());
 retry?.addEventListener('click',()=>{const text=retryText||transcript.value.trim();if(text)void processTranscript(text,false);});
 settings?.addEventListener('click',()=>void NativeAudio.openAppSettings());
 transcript.addEventListener('input',()=>void interruptForNewQuestion());
 window.addEventListener('agm-android-assistant-handoff',()=>void turnOff());
 window.addEventListener('offline',()=>{activeRequest?.abort();status.textContent=connectionText(language,false);});
 window.addEventListener('online',()=>{if(session.state()==='OFF'||session.state()==='STANDBY')status.textContent=connectionText(language,true);});
 if(isNativeAudioAvailable())void NativeAudio.addListener('speechState',event=>session.transition(event.state==='listening'?'LISTENING':event.state==='processing'?'TRANSCRIBING':'SPEECH_DETECTED'));

 async function handleMicrophoneToggle(){
  if(!session.isEnabled()){await turnOn();return;}
  if(['UNDERSTANDING','PREPARING','SPEAKING','TRANSCRIBING'].includes(session.state())){await interruptAndListen();return;}
  await turnOff();
 }
 async function interruptAndListen(){await turnOff();await turnOn();}
 async function interruptForNewQuestion(){
  if(!['UNDERSTANDING','PREPARING','SPEAKING','TRANSCRIBING'].includes(session.state()))return;
  activeRequest?.abort();activeRequest=undefined;requestSequence+=1;await stopCapture();await stopSpeaking();
  session.transition(session.isEnabled()?'STANDBY':'OFF');
 }

 async function turnOn(){
  const permission=isNativeAudioAvailable()?await NativeAudio.requestMicrophonePermission():{state:'granted'};
  if(permission.state!=='granted'){session.transition('ERROR');status.textContent=m.microphoneError;settings && (settings.hidden=!isNativeAudioAvailable());return;}
  if(settings)settings.hidden=true;
  const token=session.on();toggle.setAttribute('aria-pressed','true');void conversationLoop(token);
 }
 async function turnOff(){session.off();toggle.setAttribute('aria-pressed','false');activeRequest?.abort();activeRequest=undefined;requestSequence+=1;await stopCapture();await stopSpeaking();}
 async function conversationLoop(token:number){
  while(session.isCurrent(token)){
   try{
    session.beginCycle();session.transition('LISTENING');const result=await recognizeOnce();if(!session.isCurrent(token))return;
    const text=result.text.trim();if(!text)continue;session.markTranscript(result.timing);transcript.value=text;session.transition('UNDERSTANDING');
    await processTranscript(text,true);if(session.isCurrent(token)){session.transition('STANDBY');await new Promise(resolve=>setTimeout(resolve,250));}
   }catch(error){if(!session.isCurrent(token))return;session.transition('ERROR');status.textContent=String(error).includes('permission')?m.microphoneError:m.transcriptionError;await new Promise(resolve=>setTimeout(resolve,700));}
  }
 }
 async function recognizeOnce():Promise<{text:string;timing?:Record<string,number>}>{
  if(isNativeAudioAvailable())return NativeAudio.startListening({language:basicLanguageRegistry[language].speechLocale});
  const speechWindow=window as unknown as{SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};const Constructor=speechWindow.SpeechRecognition??speechWindow.webkitSpeechRecognition;if(!Constructor)throw new Error('microphone');
  return new Promise((resolve,reject)=>{recognition=new Constructor();recognition.lang=basicLanguageRegistry[language].speechLocale;recognition.interimResults=false;recognition.continuous=false;recognition.onresult=event=>resolve({text:String(event.results?.[0]?.[0]?.transcript??'')});recognition.onerror=reject;recognition.onend=()=>{};recognition.start();});
 }
 async function stopCapture(){try{if(isNativeAudioAvailable())await NativeAudio.stopListening();else recognition?.stop();}catch{}recognition=undefined;}
 async function processTranscript(confirmedText:string,automatic:boolean){
  if(!confirmedText){status.textContent=m.emptyTranscript;return;}
  if(!navigator.onLine){session.transition('ERROR');status.textContent=connectionText(language,false);return;}
    if(detectPremiumConversationIntent(confirmedText)==='navigate-to-car-mover'){
    if(!isPremiumNavigationAllowed('carMover')){actionPanel.hidden=true;response.textContent='Accesul Car Mover nu este acordat. Deschid fluxul de acces.';panel.hidden=false;window.history.pushState({},'', '/access');window.dispatchEvent(new PopStateEvent('popstate'));return;}
     pendingAction={id:`action:${Date.now()}`,respondsToTurnId:`turn:${Date.now()}`,capability:'navigate-to-car-mover',summary:'Deschidere AGM Car Mover',payloadPreview:'/car-mover',producesExternalEffect:false,requiresHumanConfirmation:true};
     actionSummary.textContent=`${premiumConversationMessages[language].actionPrepared} ${pendingAction.summary}?`;
     actionPanel.hidden=false;response.textContent=actionSummary.textContent;panel.hidden=false;return;
    }
  if(retry)retry.hidden=true;retryText='';const sequence=++requestSequence;activeRequest?.abort();await stopSpeaking();const controller=new AbortController();activeRequest=controller;let timedOut=false;const timeout=window.setTimeout(()=>{timedOut=true;controller.abort();},18_000);session.transition('UNDERSTANDING');session.markEngineRequest();
  try{
   const context=readOperationalContext();const result=await client.respond({productId:'agm-cockpit',moduleId:context.situationId??'premium-cockpit',language,confirmedText,...context,history:history.slice(-8)},{signal:controller.signal});if(sequence!==requestSequence)return;session.markEngineResponse();
   const groundedText=enforceVerifiedContactBoundary(confirmedText,result.text,language);history.push({role:'user',text:confirmedText},{role:'assistant',text:groundedText});while(history.length>20)history.shift();saveHistory(history);renderHistory();answerText=groundedText;response.textContent=groundedText;panel.hidden=false;
   session.transition('SPEAKING');session.markTts();const telemetry=session.snapshot();persistTelemetry(telemetry);if(latency&&telemetry){latency.textContent=`API ${telemetry.engineLatencyMs??'—'} ms · transcript → voice ${telemetry.transcriptToTtsMs??'—'} ms`;latency.hidden=false;}await speak(groundedText);
  }catch(error){if(sequence!==requestSequence)return;if(controller.signal.aborted&&!timedOut)return;session.transition('ERROR');retryText=confirmedText;if(retry){retry.textContent=retryLabel(language);retry.hidden=false;}status.textContent=timedOut?timeoutText(language):error instanceof PremiumAssistantClientError&&error.reason==='network'?m.networkError:m.aiError;}finally{window.clearTimeout(timeout);if(sequence===requestSequence)activeRequest=undefined;}
 }
 function confirmPendingAction(){
  if(!pendingAction)return;
  if(!isPremiumNavigationAllowed('carMover')){pendingAction=undefined;actionPanel.hidden=true;response.textContent='Accesul Car Mover nu este acordat. Deschid fluxul de acces.';panel.hidden=false;window.history.pushState({},'', '/access');window.dispatchEvent(new PopStateEvent('popstate'));return;}
  pendingAction=undefined;actionPanel.hidden=true;window.history.pushState({},'', '/car-mover');window.dispatchEvent(new PopStateEvent('popstate'));
 }
 function rejectPendingAction(){pendingAction=undefined;actionPanel.hidden=true;response.textContent=premiumConversationMessages[language].actionRejected;panel.hidden=false;}
 async function speak(text:string){if(!text)return;try{session.transition('SPEAKING');if(isNativeAudioAvailable()){await NativeAudio.speak({text,language:basicLanguageRegistry[language].speechLocale});return;}if(!window.speechSynthesis)throw new Error();await new Promise<void>((resolve,reject)=>{window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=basicLanguageRegistry[language].speechLocale;utterance.onend=()=>resolve();utterance.onerror=()=>reject();window.speechSynthesis.speak(utterance);});}catch{status.textContent=m.playbackError;}}
 async function stopSpeaking(){try{if(isNativeAudioAvailable())await NativeAudio.stopSpeaking();else window.speechSynthesis?.cancel();}catch{status.textContent=m.playbackError;}}
 function renderState(state:VoiceSessionState){runtimeRoot.dataset.voiceState=state;const visible=state==='LISTENING'?'LISTENING':state==='SPEECH_DETECTED'?'SPEECH_DETECTED':state==='SPEAKING'?'SPEAKING':state==='OFF'?'OFF':'PROCESSING';status.textContent=stateText[language][visible];toggle.classList.toggle('is-on',state!=='OFF');toggle.querySelector('span')!.textContent=state==='OFF'?'ASCULTARE ON':'ASCULTARE OFF';stop.hidden=true;}
 function renderHistory(){historyList.replaceChildren(...history.map(turn=>{const item=document.createElement('li');item.dataset.role=turn.role;const label=document.createElement('strong');label.textContent=turn.role==='assistant'?'AGM':m.transcript;const p=document.createElement('p');p.textContent=turn.text;item.append(label,p);return item;}));historyPanel.hidden=history.length===0;const last=[...history].reverse().find(turn=>turn.role==='assistant');if(last){answerText=last.text;response.textContent=last.text;panel.hidden=false;}}
}

function loadHistory():HistoryTurn[]{try{const value=JSON.parse(sessionStorage.getItem(HISTORY_KEY)??'[]');return Array.isArray(value)?value.filter((turn):turn is HistoryTurn=>Boolean(turn)&&(turn.role==='user'||turn.role==='assistant')&&typeof turn.text==='string').slice(-20):[];}catch{return[];}}
function saveHistory(history:HistoryTurn[]){sessionStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-20)));}
function persistTelemetry(value:unknown){if(!value)return;try{const rows=JSON.parse(sessionStorage.getItem(TELEMETRY_KEY)??'[]');const next=Array.isArray(rows)?rows:[];next.push(value);sessionStorage.setItem(TELEMETRY_KEY,JSON.stringify(next.slice(-50)));}catch{}}
function readOperationalContext(){try{const value=JSON.parse(sessionStorage.getItem('agm.premium.trip-context.v1')??'null')??{};return{tripId:text(value.tripId),operationalCaseId:text(value.operationalCaseId),situationId:text(value.situationId)};}catch{return{};}}
function text(value:unknown){return typeof value==='string'&&value.trim()?value.trim():undefined;}
function connectionText(language:string,online:boolean){const copy:Record<string,[string,string]>={ro:['Conexiunea mobilă a revenit. Poți continua.','Nu există conexiune. Verifică datele mobile și încearcă din nou.'],de:['Die Verbindung ist wieder verfügbar. Sie können fortfahren.','Keine Verbindung. Prüfen Sie die mobilen Daten und versuchen Sie es erneut.'],en:['The connection is back. You can continue.','No connection. Check mobile data and try again.']};const [yes,no]=copy[language]??copy.en;return online?yes:no;}
function timeoutText(language:string){return({ro:'Răspunsul durează prea mult. Verifică semnalul și încearcă din nou.',de:'Die Antwort dauert zu lange. Prüfen Sie das Signal und versuchen Sie es erneut.',en:'The response is taking too long. Check the signal and try again.'} as Record<string,string>)[language]??'The response is taking too long. Check the signal and try again.';}
function retryLabel(language:string){return({ro:'↻ Încearcă din nou',de:'↻ Erneut versuchen',en:'↻ Try again'} as Record<string,string>)[language]??'↻ Retry';}
