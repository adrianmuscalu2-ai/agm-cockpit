export const PREMIUM_COPILOT_FLAG='agm.premium.single-copilot.enabled';
export const PREMIUM_COPILOT_STATE='agm.premium.single-copilot.state.v1';
export type CopilotIntent='GENERAL_QUESTION'|'DASHBOARD_WARNING'|'DOCUMENT'|'SAFETY'|'LOCATION'|'PHONE'|'COMMUNICATION'|'UNKNOWN';
export type CopilotCapability={id:string;intents:readonly CopilotIntent[];authority:'READ'|'PREPARE'|'DEVICE_HANDOFF';enabledInC0:boolean;safetyFirst:boolean};
export const copilotCapabilities:readonly CopilotCapability[]=[
 {id:'conversation',intents:['GENERAL_QUESTION'],authority:'READ',enabledInC0:true,safetyFirst:false},
 {id:'safety-guidance',intents:['SAFETY','DASHBOARD_WARNING'],authority:'READ',enabledInC0:true,safetyFirst:true},
 {id:'document-ocr',intents:['DOCUMENT'],authority:'PREPARE',enabledInC0:true,safetyFirst:false},
 {id:'location-maps',intents:['LOCATION'],authority:'DEVICE_HANDOFF',enabledInC0:false,safetyFirst:false},
 {id:'phone-dialer',intents:['PHONE'],authority:'DEVICE_HANDOFF',enabledInC0:false,safetyFirst:false},
 {id:'communications',intents:['COMMUNICATION'],authority:'PREPARE',enabledInC0:false,safetyFirst:false},
] as const;
export type CopilotDecision={intent:CopilotIntent;capabilityId?:string;confidence:'HIGH'|'MEDIUM'|'LOW';requiresClarification:boolean;safetyGate:boolean;executionAllowed:false};
const patterns:Record<Exclude<CopilotIntent,'GENERAL_QUESTION'|'UNKNOWN'>,RegExp>={
 SAFETY:/accident|rănit|ranit|pericol|urgen|nu.*sigur|emergency|danger|injur|unfall|gefahr|notfall/i,
 DASHBOARD_WARNING:/martor|frân|fran|motor|defec|avar|warning|brake|engine|fault|kontrollleuchte|bremse/i,
 DOCUMENT:/document|acte|cmr|permis|licen|factur|ocr|scan|fotograf|photo|dokument/i,
 LOCATION:/aproape|loca|hart|maps|naviga|platformă|platforma|nearby|route|karte|navigation/i,
 PHONE:/sună|suna|apel|telefon|call|anrufen/i,
 COMMUNICATION:/trimite|mesaj|email|whatsapp|dispecer|send|message|nachricht/i,
};
export function routeCopilotIntent(text:string):CopilotDecision{const value=text.trim();if(!value)return{intent:'UNKNOWN',confidence:'LOW',requiresClarification:true,safetyGate:false,executionAllowed:false};for(const intent of ['SAFETY','DASHBOARD_WARNING','DOCUMENT','LOCATION','PHONE','COMMUNICATION'] as const){if(patterns[intent].test(value)){const cap=copilotCapabilities.find(c=>c.intents.includes(intent));return{intent,capabilityId:cap?.id,confidence:'HIGH',requiresClarification:false,safetyGate:cap?.safetyFirst??false,executionAllowed:false}}}return{intent:'GENERAL_QUESTION',capabilityId:'conversation',confidence:value.length>8?'MEDIUM':'LOW',requiresClarification:value.length<=8,safetyGate:false,executionAllowed:false}}
// C0 is the approved Premium projection. Only an explicit false performs the
// nondestructive rollback to the legacy projection.
export function copilotEnabled(storage:Pick<Storage,'getItem'>){return storage.getItem(PREMIUM_COPILOT_FLAG)!=='false';}
