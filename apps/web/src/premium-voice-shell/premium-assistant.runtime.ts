import { basicLanguageRegistry, isBasicLanguageCode } from '../language-registry';
import { isNativeAudioAvailable, NativeAudio, type NativeAudioStopReceipt } from '../native-audio';
import { createPremiumAssistantClient, PremiumAssistantClientError } from './premium-assistant.client';
import { premiumAssistantUiMessages } from './premium-assistant-ui.i18n';
import { enforceVerifiedContactBoundary } from './premium-assistant-grounding';
import { VoiceSessionController, type VoiceSessionState } from './voice-session';
import { isPremiumNavigationAllowed } from '../premium-access/premium-access.navigation';
import { detectPremiumConversationIntent, type PremiumConversationActionProposal } from './premium-conversation.contract';
import { premiumConversationMessages } from './premium-conversation.i18n';
import { recordRoutingMetric, routeDeviceOperation } from '../device-capability-router/device-capability.runtime';

type Recognition = { lang:string;interimResults:boolean;continuous:boolean;onresult:((event:any)=>void)|null;onerror:((event:any)=>void)|null;onend:(()=>void)|null;onspeechstart?:(()=>void)|null;onspeechend?:(()=>void)|null;start():void;stop():void;abort?():void };
type RecognitionConstructor = new()=>Recognition;
type HistoryTurn={role:'user'|'assistant';text:string};
const HISTORY_KEY='agm.premium.assistant.history.v1';
const TELEMETRY_KEY='agm.premium.voice.telemetry.v1';
type RuntimeAudioStopReceipt={stoppedTurnId?:string;stoppedAtMs:number;queueFlushed:boolean;native?:NativeAudioStopReceipt};
type CancellationLease={token:number;sequence:number};
let globalCancellationBarrier:Promise<void>=Promise.resolve();
let disposeActivePremiumAssistantRuntime:(()=>void)|undefined;

function enqueueVoiceCancellation<T>(work:()=>Promise<T>):Promise<T>{
 const run=globalCancellationBarrier.then(work,work);globalCancellationBarrier=run.then(()=>undefined,()=>undefined);return run;
}

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
 disposeActivePremiumAssistantRuntime?.();disposeActivePremiumAssistantRuntime=undefined;
 const root=document.querySelector<HTMLElement>('[data-premium-assistant], [data-premium-copilot]');if(!root)return;
 const runtimeRoot=root;
 const language=isBasicLanguageCode(root.dataset.language)?root.dataset.language:'en';const m=premiumAssistantUiMessages[language];
 const transcript=root.querySelector<HTMLTextAreaElement>('[data-assistant-transcript]')!;const status=root.querySelector<HTMLElement>('[data-assistant-status]')!;
 const toggle=root.querySelector<HTMLButtonElement>('[data-assistant-start]')!;const stop=root.querySelector<HTMLButtonElement>('[data-assistant-stop]')!;
 const panel=root.querySelector<HTMLElement>('[data-assistant-response-panel]')!;const response=root.querySelector<HTMLElement>('[data-assistant-response]')!;
 const latency=root.querySelector<HTMLElement>('[data-assistant-latency]');const settings=root.querySelector<HTMLButtonElement>('[data-assistant-open-settings]');
 const retry=root.querySelector<HTMLButtonElement>('[data-assistant-retry]');let retryText='';
 const historyPanel=root.querySelector<HTMLElement>('[data-assistant-history-panel]')!;const historyList=root.querySelector<HTMLOListElement>('[data-assistant-history]')!;
 const actionPanel=root.querySelector<HTMLElement>('[data-assistant-action-panel]');const actionSummary=root.querySelector<HTMLElement>('[data-assistant-action-summary]');let pendingAction:PremiumConversationActionProposal|undefined;
 const env=(import.meta as ImportMeta&{env?:Record<string,string|boolean|undefined>}).env;const configured=typeof env?.VITE_AGM_API_BASE_URL==='string'?env.VITE_AGM_API_BASE_URL.trim():'';const apiBase=configured||(env?.DEV===true?'/api/v1':'');
 const client=createPremiumAssistantClient({apiBaseUrl:apiBase,fetch:window.fetch.bind(window),sessionStorage});const history=loadHistory();let answerText='';let activeRequest:AbortController|undefined;let requestSequence=0;let recognition:Recognition|undefined;let cancelRecognitionPromise:(()=>void)|undefined;let activeTurnId:string|undefined;let activeBrowserSpeech:{turnId:string;resolve:()=>void}|undefined;let lastAudioStopReceipt:RuntimeAudioStopReceipt|undefined;let disposed=false;const staleTurnEvents=new Set<string>();const nativeListenerHandles:Array<{remove:()=>Promise<void>}>=[];
 const session=new VoiceSessionController(renderState);renderHistory();renderState('OFF');

 const offlineHandler=()=>{activeRequest?.abort();status.textContent=connectionText(language,false);};
 const onlineHandler=()=>{if(session.state()==='OFF'||session.state()==='STANDBY')status.textContent=connectionText(language,true);};
 const handoffHandler=()=>void turnOff();
 disposeActivePremiumAssistantRuntime=()=>{
  if(disposed)return;disposed=true;session.off();requestSequence+=1;activeRequest?.abort();activeRequest=undefined;activeTurnId=undefined;
  delete runtimeRoot.dataset.activeVoiceTurn;
  window.removeEventListener('agm-android-assistant-handoff',handoffHandler);window.removeEventListener('offline',offlineHandler);window.removeEventListener('online',onlineHandler);
  for(const handle of nativeListenerHandles)void handle.remove();
  void enqueueVoiceCancellation(async()=>{await Promise.allSettled([stopCapture(),stopSpeaking()]);});
 };

 toggle.addEventListener('click',()=>void handleMicrophoneToggle());
 stop.addEventListener('click',()=>void turnOff());
 root.querySelector('[data-assistant-cancel]')?.addEventListener('click',()=>{transcript.value='';void turnOff();});
 root.querySelector('[data-assistant-confirm]')?.addEventListener('click',()=>void submitNewUserTurn(transcript.value.trim()));
 root.querySelector('[data-assistant-replay]')?.addEventListener('click',()=>void replayAnswer());
 root.querySelector('[data-assistant-stop-playback]')?.addEventListener('click',()=>void cancelPlaybackOnly());
 root.querySelector('[data-assistant-action-confirm]')?.addEventListener('click',()=>confirmPendingAction());
 root.querySelector('[data-assistant-action-reject]')?.addEventListener('click',()=>rejectPendingAction());
 retry?.addEventListener('click',()=>{const text=retryText||transcript.value.trim();if(text)void submitNewUserTurn(text);});
 settings?.addEventListener('click',()=>void NativeAudio.openAppSettings());
 // `beforeinput` runs before the first new character is committed. Android
 // therefore revokes the old TTS authority at the beginning of the new user
 // action, while `input` remains a fallback for IME implementations that do
 // not dispatch beforeinput consistently.
 transcript.addEventListener('beforeinput',()=>void interruptForNewQuestion());
 transcript.addEventListener('input',()=>void interruptForNewQuestion());
 window.addEventListener('agm-android-assistant-handoff',handoffHandler);
 window.addEventListener('offline',offlineHandler);
 window.addEventListener('online',onlineHandler);
 if(isNativeAudioAvailable()){
  void NativeAudio.addListener('speechState',event=>{if(disposed||event.cycleId!==session.currentCycleId()){recordStaleEvent(`stt-event:${event.cycleId}`,'stt-callback');return;}if(event.state==='speechDetected'){session.markSpeech();persistTelemetry({kind:'barge-in',platform:'android',cycleId:event.cycleId,stoppedTurnId:event.stoppedTurnId,newSpeechDetectedToOldAudioStopMs:event.oldAudioStopLatencyMs??0,oldAudioStoppedAtElapsedRealtimeMs:event.oldAudioStoppedAtElapsedRealtimeMs,detectedAtElapsedRealtimeMs:event.detectedAtElapsedRealtimeMs,at:Date.now()});}session.transition(event.state==='listening'?'LISTENING':event.state==='processing'?'TRANSCRIBING':'SPEECH_DETECTED');}).then(handle=>{if(disposed)void handle.remove();else nativeListenerHandles.push(handle);});
  void NativeAudio.addListener('ttsState',event=>{if(disposed||event.turnId!==activeTurnId){recordStaleEvent(`tts-event:${event.turnId}:${event.state}`,'tts-callback');return;}if(event.state==='speaking')markAudioStarted(event.turnId,event.requestToAudioStartMs);}).then(handle=>{if(disposed)void handle.remove();else nativeListenerHandles.push(handle);});
 }

 async function handleMicrophoneToggle(){
  if(isTurnActive()){if(session.isEnabled())await interruptAndListen();else{const lease=await preemptCurrentTurn('microphone-barge-in');if(isLeaseCurrent(lease))await turnOn(lease.sequence);}return;}
  if(!session.isEnabled()){await turnOn();return;}
  await turnOff();
 }
 async function interruptAndListen(){const lease=await preemptCurrentTurn('microphone-restart');if(!isLeaseCurrent(lease))return;void conversationLoop(lease.token);}
 async function interruptForNewQuestion(){
  if(!isTurnActive())return;
  await preemptCurrentTurn('new-user-input');
 }

 async function preemptCurrentTurn(reason:string):Promise<CancellationLease>{
  const interruptedState=session.state();const cancelledTurnId=activeTurnId;const token=session.interrupt();const sequence=++requestSequence;const startedAt=performance.now();
  activeRequest?.abort();activeRequest=undefined;activeTurnId=undefined;delete runtimeRoot.dataset.activeVoiceTurn;
  const cancellation=await enqueueVoiceCancellation(async()=>{
   const results=await Promise.allSettled([stopCapture(),stopSpeaking()]);const audio=results[1].status==='fulfilled'?results[1].value:undefined;if(audio)lastAudioStopReceipt=audio;return audio;
  });
  if(isLeaseCurrent({token,sequence})){pendingAction=undefined;if(actionPanel)actionPanel.hidden=true;retryText='';if(retry)retry.hidden=true;answerText='';response.textContent='';panel.hidden=true;}
  const completedAt=performance.now();persistTelemetry({kind:'interrupt',reason,interruptedState,cancelledTurnId,sequence,cancelLatencyMs:Math.round(completedAt-startedAt),newTurnToOldAudioStopMs:Math.max(0,Math.round((cancellation?.stoppedAtMs??completedAt)-startedAt)),audioQueueFlushed:cancellation?.queueFlushed??true,at:Date.now()});
  return{token,sequence};
 }
 function isLeaseCurrent(lease:CancellationLease){return!disposed&&lease.sequence===requestSequence&&session.isGenerationCurrent(lease.token);}
 function isTurnActive(){return Boolean(activeRequest||recognition||activeBrowserSpeech||activeTurnId)||['LISTENING','SPEECH_DETECTED','TRANSCRIBING','UNDERSTANDING','PREPARING','SPEAKING'].includes(session.state());}
 async function submitNewUserTurn(text:string){
  if(!text){status.textContent=m.emptyTranscript;return;}
  const lease=await preemptCurrentTurn('new-user-input');if(!isLeaseCurrent(lease))return;session.beginCycle();session.markTranscript({manualInputMs:0});
  const completed=await processTranscript(text);if(!session.isGenerationCurrent(lease.token)||!completed)return;
  session.settle();if(session.isEnabled())void conversationLoop(lease.token);
 }

 async function turnOn(expectedSequence?:number){
  const sequence=expectedSequence??++requestSequence;
  const permission=isNativeAudioAvailable()?await NativeAudio.requestMicrophonePermission():{state:'granted'};
  if(disposed||sequence!==requestSequence)return;
  if(permission.state!=='granted'){session.transition('ERROR');status.textContent=m.microphoneError;settings && (settings.hidden=!isNativeAudioAvailable());return;}
  if(settings)settings.hidden=true;
  const token=session.on();toggle.setAttribute('aria-pressed','true');void conversationLoop(token);
 }
 async function turnOff(){session.off();toggle.setAttribute('aria-pressed','false');requestSequence+=1;activeRequest?.abort();activeRequest=undefined;activeTurnId=undefined;delete runtimeRoot.dataset.activeVoiceTurn;await enqueueVoiceCancellation(async()=>{const results=await Promise.allSettled([stopCapture(),stopSpeaking()]);if(results[1].status==='fulfilled')lastAudioStopReceipt=results[1].value;});}
 async function conversationLoop(token:number){
  while(!disposed&&session.isCurrent(token)){
   try{
    session.beginCycle();session.transition('LISTENING');const cycleId=session.currentCycleId()!;const result=await recognizeOnce(cycleId);if(!session.isCurrent(token))return;
    const text=result.text.trim();if(!text)continue;session.markTranscript(result.timing);transcript.value=text;session.transition('UNDERSTANDING');
    const completed=await processTranscript(text);if(!completed||!session.isCurrent(token))return;session.settle();await new Promise(resolve=>setTimeout(resolve,80));
   }catch(error){
    if(!session.isCurrent(token))return;
    const errorText=String(error).includes('permission')?m.microphoneError:m.transcriptionError;
    persistTelemetry({kind:'stt-terminal-error',cycleId:session.currentCycleId(),error:String(error),at:Date.now()});
    // A no-match/service error is terminal for the current hands-free session.
    // Automatic retries caused an endless LISTENING blink and repeatedly
    // reopened the microphone until the user pressed Cancel.
    session.off();toggle.setAttribute('aria-pressed','false');status.textContent=errorText;
    return;
   }
  }
 }
 async function recognizeOnce(cycleId:string):Promise<{text:string;timing?:Record<string,number>}>{
  if(isNativeAudioAvailable())return NativeAudio.startListening({language:basicLanguageRegistry[language].speechLocale,cycleId});
  const speechWindow=window as unknown as{SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};const Constructor=speechWindow.SpeechRecognition??speechWindow.webkitSpeechRecognition;if(!Constructor)throw new Error('microphone');
  return new Promise((resolve,reject)=>{
   const startedAt=performance.now();let speechStartedAt=startedAt;let speechEndedAt=startedAt;let settled=false;const instance=new Constructor();recognition=instance;
   const current=()=>!disposed&&session.currentCycleId()===cycleId&&recognition===instance;
   const cleanup=()=>{if(recognition===instance)recognition=undefined;if(cancelRecognitionPromise===cancel)cancelRecognitionPromise=undefined;};
   const rejectOnce=(error:unknown)=>{if(settled)return;settled=true;cleanup();reject(error);};
   const resolveOnce=(value:{text:string;timing?:Record<string,number>})=>{if(settled)return;settled=true;cleanup();resolve(value);};
   const cancel=()=>rejectOnce(new DOMException('Voice turn cancelled','AbortError'));cancelRecognitionPromise=cancel;
   instance.lang=basicLanguageRegistry[language].speechLocale;instance.interimResults=false;instance.continuous=false;
   instance.onspeechstart=()=>{if(!current()){recordStaleEvent(`stt-event:${cycleId}`,'speech-start');return;}speechStartedAt=performance.now();session.markSpeech();session.transition('SPEECH_DETECTED');const receipt=lastAudioStopReceipt;persistTelemetry({kind:'barge-in',platform:'browser',cycleId,newSpeechDetectedToOldAudioStopMs:receipt&&performance.now()-receipt.stoppedAtMs<30_000?Math.max(0,Math.round(receipt.stoppedAtMs-speechStartedAt)):0,audioQueueFlushed:receipt?.queueFlushed??true,at:Date.now()});};
   instance.onspeechend=()=>{if(!current()){recordStaleEvent(`stt-event:${cycleId}`,'speech-end');return;}speechEndedAt=performance.now();session.transition('TRANSCRIBING');};
   instance.onresult=event=>{if(!current()){recordStaleEvent(`stt-event:${cycleId}`,'result');rejectOnce(new DOMException('Stale speech result','AbortError'));return;}const resultAt=performance.now();resolveOnce({text:String(event.results?.[0]?.[0]?.transcript??''),timing:{startToSpeechMs:Math.round(speechStartedAt-startedAt),speechToEndMs:Math.round(speechEndedAt-speechStartedAt),silenceToEndMs:0,endToResultMs:Math.round(resultAt-speechEndedAt),totalRecognitionMs:Math.round(resultAt-startedAt)}});};
   instance.onerror=event=>rejectOnce(event);instance.onend=()=>{if(!settled&&!current())rejectOnce(new DOMException('Stale speech session','AbortError'));};instance.start();
  });
 }
 async function stopCapture(){const current=recognition;const cancel=cancelRecognitionPromise;recognition=undefined;cancelRecognitionPromise=undefined;cancel?.();try{if(isNativeAudioAvailable())await NativeAudio.stopListening();else if(current?.abort)current.abort();else current?.stop();}catch{}}
 async function processTranscript(confirmedText:string):Promise<boolean>{
  if(!confirmedText){status.textContent=m.emptyTranscript;return false;}
  if(!navigator.onLine){session.transition('ERROR');status.textContent=connectionText(language,false);return false;}
    if(detectPremiumConversationIntent(confirmedText)==='navigate-to-car-mover'){
    if(!isPremiumNavigationAllowed('carMover')){if(actionPanel)actionPanel.hidden=true;response.textContent='Accesul Car Mover nu este acordat. Deschid fluxul de acces.';panel.hidden=false;window.history.pushState({},'', '/access');window.dispatchEvent(new PopStateEvent('popstate'));return true;}
     pendingAction={id:`action:${Date.now()}`,respondsToTurnId:`turn:${Date.now()}`,capability:'navigate-to-car-mover',summary:'Deschidere AGM Car Mover',payloadPreview:'/car-mover',producesExternalEffect:false,requiresHumanConfirmation:true};
     const summary=`${premiumConversationMessages[language].actionPrepared} ${pendingAction.summary}?`;if(actionSummary)actionSummary.textContent=summary;
     if(actionPanel)actionPanel.hidden=false;response.textContent=summary;panel.hidden=false;return true;
    }
  if(retry)retry.hidden=true;retryText='';const sequence=++requestSequence;const turnId=`turn:${sequence}:${Date.now()}`;activeTurnId=turnId;runtimeRoot.dataset.activeVoiceTurn=turnId;activeRequest?.abort();lastAudioStopReceipt=await enqueueVoiceCancellation(()=>stopSpeaking());if(sequence!==requestSequence||disposed){recordStaleEvent(turnId,'before-model-request');return false;}const controller=new AbortController();activeRequest=controller;let timedOut=false;const timeout=window.setTimeout(()=>{timedOut=true;controller.abort();},18_000);session.transition('UNDERSTANDING');session.markEngineRequest();
  try{
   const context=readOperationalContext();const routing=await routeDeviceOperation({operation:'AGM_CONTEXT_REASONING',sensitivity:'PERSONAL',requiresAgmContext:true});if(routing.authority!=='AGM_AI')throw new PremiumAssistantClientError('network');const modelStartedAt=performance.now();let result:Awaited<ReturnType<typeof client.respond>>;
   try{result=await client.respond({productId:'agm-cockpit',moduleId:context.situationId??'premium-cockpit',language,confirmedText,...context,history:history.slice(-4)},{signal:controller.signal});recordRoutingMetric({operation:'AGM_CONTEXT_REASONING',authority:'AGM_AI',executionMode:routing.executionMode,decisionLatencyMs:routing.decisionLatencyMs,executionLatencyMs:performance.now()-modelStartedAt,success:true,atEpochMs:Date.now()});}
   catch(error){recordRoutingMetric({operation:'AGM_CONTEXT_REASONING',authority:'AGM_AI',executionMode:routing.executionMode,decisionLatencyMs:routing.decisionLatencyMs,executionLatencyMs:performance.now()-modelStartedAt,success:false,atEpochMs:Date.now()});throw error;}
   if(sequence!==requestSequence||disposed){recordStaleEvent(turnId,'model-response');return false;}session.markEngineResponse(result.timing);
   const groundedText=enforceVerifiedContactBoundary(confirmedText,result.text,language);history.push({role:'user',text:confirmedText},{role:'assistant',text:groundedText});while(history.length>20)history.shift();saveHistory(history);renderHistory();answerText=groundedText;response.textContent=groundedText;panel.hidden=false;
   session.transition('PREPARING');session.markTtsRequest();renderLatency(session.snapshot());const spoken=await speak(groundedText,sequence,turnId);if(sequence!==requestSequence||disposed){recordStaleEvent(turnId,'tts-completion');return false;}activeTurnId=undefined;delete runtimeRoot.dataset.activeVoiceTurn;return spoken;
  }catch(error){if(sequence!==requestSequence||disposed){recordStaleEvent(turnId,'model-error');return false;}if(controller.signal.aborted&&!timedOut)return false;session.transition('ERROR');retryText=confirmedText;if(retry){retry.textContent=retryLabel(language);retry.hidden=false;}status.textContent=timedOut?timeoutText(language):error instanceof PremiumAssistantClientError&&error.reason==='network'?m.networkError:m.aiError;return false;}finally{window.clearTimeout(timeout);if(activeRequest===controller)activeRequest=undefined;if(sequence===requestSequence&&session.state()==='ERROR'){activeTurnId=undefined;delete runtimeRoot.dataset.activeVoiceTurn;}}
 }
 function confirmPendingAction(){
  if(!pendingAction)return;
  if(!isPremiumNavigationAllowed('carMover')){pendingAction=undefined;if(actionPanel)actionPanel.hidden=true;response.textContent='Accesul Car Mover nu este acordat. Deschid fluxul de acces.';panel.hidden=false;window.history.pushState({},'', '/access');window.dispatchEvent(new PopStateEvent('popstate'));return;}
  pendingAction=undefined;if(actionPanel)actionPanel.hidden=true;window.history.pushState({},'', '/car-mover');window.dispatchEvent(new PopStateEvent('popstate'));
 }
 function rejectPendingAction(){pendingAction=undefined;if(actionPanel)actionPanel.hidden=true;response.textContent=premiumConversationMessages[language].actionRejected;panel.hidden=false;}
 async function replayAnswer(){if(!answerText)return;const text=answerText;const lease=await preemptCurrentTurn('replay');if(!isLeaseCurrent(lease))return;session.beginCycle();session.markTranscript({manualReplayMs:0});const sequence=++requestSequence;const turnId=`replay:${sequence}:${Date.now()}`;activeTurnId=turnId;runtimeRoot.dataset.activeVoiceTurn=turnId;session.transition('PREPARING');session.markTtsRequest();await speak(text,sequence,turnId);if(sequence!==requestSequence||!session.isGenerationCurrent(lease.token))return;activeTurnId=undefined;delete runtimeRoot.dataset.activeVoiceTurn;session.settle();if(session.isEnabled())void conversationLoop(lease.token);}
 async function cancelPlaybackOnly(){const lease=await preemptCurrentTurn('playback-stop');if(isLeaseCurrent(lease))session.settle();}
 async function speak(text:string,sequence:number,turnId:string){if(!text)return false;try{if(isNativeAudioAvailable()){await NativeAudio.speak({text,language:basicLanguageRegistry[language].speechLocale,turnId});return sequence===requestSequence&&!disposed;}if(!window.speechSynthesis)throw new Error();await new Promise<void>((resolve,reject)=>{let settled=false;const finish=()=>{if(settled)return;settled=true;if(activeBrowserSpeech?.turnId===turnId)activeBrowserSpeech=undefined;resolve();};window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=basicLanguageRegistry[language].speechLocale;utterance.onstart=()=>{if(sequence!==requestSequence||turnId!==activeTurnId){recordStaleEvent(turnId,'tts-start');finish();return;}markAudioStarted(turnId);};utterance.onend=()=>{if(sequence!==requestSequence)recordStaleEvent(turnId,'tts-end');finish();};utterance.onerror=()=>{if(sequence!==requestSequence){recordStaleEvent(turnId,'tts-error');finish();return;}reject(new Error('playback'));};activeBrowserSpeech={turnId,resolve:finish};window.speechSynthesis.speak(utterance);});return sequence===requestSequence&&!disposed;}catch{if(sequence===requestSequence&&!disposed)status.textContent=m.playbackError;return false;}}
 async function stopSpeaking():Promise<RuntimeAudioStopReceipt>{const browserSpeech=activeBrowserSpeech;const stoppedTurnId=browserSpeech?.turnId??activeTurnId;activeBrowserSpeech=undefined;try{if(isNativeAudioAvailable()){const native=await NativeAudio.stopSpeaking();return{stoppedTurnId:native.stoppedTurnId??stoppedTurnId,stoppedAtMs:performance.now(),queueFlushed:native.queueFlushed,native};}window.speechSynthesis?.cancel();browserSpeech?.resolve();return{stoppedTurnId,stoppedAtMs:performance.now(),queueFlushed:true};}catch{browserSpeech?.resolve();return{stoppedTurnId,stoppedAtMs:performance.now(),queueFlushed:true};}}
 function recordStaleEvent(turnId:string,stage:string){const key=`${turnId}:${stage}`;if(staleTurnEvents.has(key))return;staleTurnEvents.add(key);persistTelemetry({kind:'stale-suppressed',turnId,stage,sequence:requestSequence,at:Date.now()});}
 function markAudioStarted(turnId:string,nativeRequestToStartMs?:number){if(turnId!==activeTurnId)return;session.markAudioStart(nativeRequestToStartMs);session.transition('SPEAKING');const telemetry=session.snapshot();persistTelemetry(telemetry);renderLatency(telemetry);}
 function renderLatency(telemetry:ReturnType<VoiceSessionController['snapshot']>){if(!latency||!telemetry)return;const native=telemetry.nativeTiming??{};latency.textContent=`MIC→speech ${native.startToSpeechMs??'—'} ms · VAD ${native.silenceToEndMs??'—'} ms · STT ${native.endToResultMs??'—'} ms · orchestrator ${telemetry.serverTiming?.orchestratorMs??'—'} ms · model ${telemetry.serverTiming?.modelMs??telemetry.engineLatencyMs??'—'} ms · network ${telemetry.networkLatencyMs??'—'} ms · TTS→audio ${telemetry.ttsRequestToAudioStartMs??'—'} ms · transcript→audio ${telemetry.transcriptToAudioStartMs??'—'} ms · MIC→audio ${telemetry.micToAudioStartMs??'—'} ms`;latency.hidden=false;}
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
