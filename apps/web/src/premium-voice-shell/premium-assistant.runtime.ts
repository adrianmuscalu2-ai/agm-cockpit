import { basicLanguageRegistry, isBasicLanguageCode } from '../language-registry';
import { isNativeAudioAvailable, NativeAudio } from '../native-audio';
import { createPremiumAssistantClient, PremiumAssistantClientError } from './premium-assistant.client';
import { premiumAssistantUiMessages } from './premium-assistant-ui.i18n';
import { enforceVerifiedContactBoundary } from './premium-assistant-grounding';
import { VoiceSessionController, type VoiceSessionState } from './voice-session';

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
 const historyPanel=root.querySelector<HTMLElement>('[data-assistant-history-panel]')!;const historyList=root.querySelector<HTMLOListElement>('[data-assistant-history]')!;
 const env=(import.meta as ImportMeta&{env?:Record<string,string|boolean|undefined>}).env;const configured=typeof env?.VITE_AGM_API_BASE_URL==='string'?env.VITE_AGM_API_BASE_URL.trim():'';const apiBase=configured||(env?.DEV===true?'/api/v1':'');
 const client=createPremiumAssistantClient({apiBaseUrl:apiBase,fetch:window.fetch.bind(window),sessionStorage});const history=loadHistory();let answerText='';let requestInFlight=false;let recognition:Recognition|undefined;
 const session=new VoiceSessionController(renderState);renderHistory();renderState('OFF');

 toggle.addEventListener('click',()=>session.isEnabled()?void turnOff():void turnOn());
 stop.addEventListener('click',()=>void turnOff());
 root.querySelector('[data-assistant-cancel]')?.addEventListener('click',()=>{transcript.value='';void turnOff();});
 root.querySelector('[data-assistant-confirm]')?.addEventListener('click',()=>void processTranscript(transcript.value.trim(),false));
 root.querySelector('[data-assistant-replay]')?.addEventListener('click',()=>void speak(answerText));
 root.querySelector('[data-assistant-stop-playback]')?.addEventListener('click',()=>void stopSpeaking());
 if(isNativeAudioAvailable())void NativeAudio.addListener('speechState',event=>session.transition(event.state==='listening'?'LISTENING':event.state==='processing'?'TRANSCRIBING':'SPEECH_DETECTED'));

 async function turnOn(){
  const permission=isNativeAudioAvailable()?await NativeAudio.requestMicrophonePermission():{state:'granted'};
  if(permission.state!=='granted'){session.transition('ERROR');status.textContent=m.microphoneError;return;}
  const token=session.on();toggle.setAttribute('aria-pressed','true');void conversationLoop(token);
 }
 async function turnOff(){session.off();toggle.setAttribute('aria-pressed','false');await stopCapture();await stopSpeaking();}
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
  if(requestInFlight||!confirmedText){if(!confirmedText)status.textContent=m.emptyTranscript;return;}requestInFlight=true;session.transition('UNDERSTANDING');session.markEngineRequest();
  try{
   const context=readOperationalContext();const result=await client.respond({productId:'agm-cockpit',moduleId:context.situationId??'premium-cockpit',language,confirmedText,...context,history:history.slice(-20)});
   const groundedText=enforceVerifiedContactBoundary(confirmedText,result.text,language);history.push({role:'user',text:confirmedText},{role:'assistant',text:groundedText});while(history.length>20)history.shift();saveHistory(history);renderHistory();answerText=groundedText;response.textContent=groundedText;panel.hidden=false;
   session.transition('SPEAKING');session.markTts();persistTelemetry(session.snapshot());await speak(groundedText);
  }catch(error){session.transition('ERROR');status.textContent=error instanceof PremiumAssistantClientError&&error.reason==='network'?m.networkError:m.aiError;if(!automatic)throw error;}finally{requestInFlight=false;}
 }
 async function speak(text:string){if(!text)return;try{session.transition('SPEAKING');if(isNativeAudioAvailable()){await NativeAudio.speak({text,language:basicLanguageRegistry[language].speechLocale});return;}if(!window.speechSynthesis)throw new Error();await new Promise<void>((resolve,reject)=>{window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=basicLanguageRegistry[language].speechLocale;utterance.onend=()=>resolve();utterance.onerror=()=>reject();window.speechSynthesis.speak(utterance);});}catch{status.textContent=m.playbackError;}}
 async function stopSpeaking(){try{if(isNativeAudioAvailable())await NativeAudio.stopSpeaking();else window.speechSynthesis?.cancel();}catch{status.textContent=m.playbackError;}}
 function renderState(state:VoiceSessionState){runtimeRoot.dataset.voiceState=state;const visible=state==='LISTENING'?'LISTENING':state==='SPEECH_DETECTED'?'SPEECH_DETECTED':state==='SPEAKING'?'SPEAKING':state==='OFF'?'OFF':'PROCESSING';status.textContent=stateText[language][visible];toggle.classList.toggle('is-on',state!=='OFF');toggle.querySelector('span')!.textContent=state==='OFF'?'ASCULTARE ON':'ASCULTARE OFF';stop.hidden=true;}
 function renderHistory(){historyList.replaceChildren(...history.map(turn=>{const item=document.createElement('li');item.dataset.role=turn.role;const label=document.createElement('strong');label.textContent=turn.role==='assistant'?'AGM':m.transcript;const p=document.createElement('p');p.textContent=turn.text;item.append(label,p);return item;}));historyPanel.hidden=history.length===0;const last=[...history].reverse().find(turn=>turn.role==='assistant');if(last){answerText=last.text;response.textContent=last.text;panel.hidden=false;}}
}

function loadHistory():HistoryTurn[]{try{const value=JSON.parse(sessionStorage.getItem(HISTORY_KEY)??'[]');return Array.isArray(value)?value.filter((turn):turn is HistoryTurn=>Boolean(turn)&&(turn.role==='user'||turn.role==='assistant')&&typeof turn.text==='string').slice(-20):[];}catch{return[];}}
function saveHistory(history:HistoryTurn[]){sessionStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-20)));}
function persistTelemetry(value:unknown){if(!value)return;try{const rows=JSON.parse(localStorage.getItem(TELEMETRY_KEY)??'[]');const next=Array.isArray(rows)?rows:[];next.push(value);localStorage.setItem(TELEMETRY_KEY,JSON.stringify(next.slice(-50)));}catch{}}
function readOperationalContext(){try{const value=JSON.parse(localStorage.getItem('agm.premium.trip-context.v1')??'null')??{};return{tripId:text(value.tripId),operationalCaseId:text(value.operationalCaseId),situationId:text(value.situationId)};}catch{return{};}}
function text(value:unknown){return typeof value==='string'&&value.trim()?value.trim():undefined;}
