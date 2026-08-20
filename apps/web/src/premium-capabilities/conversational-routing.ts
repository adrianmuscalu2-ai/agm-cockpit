import type { CopilotDecision } from '../premium-copilot/copilot.contract';
import type { CapabilityId, HandoffReceipt } from './capability.types';

export const WAVE_2D_ROUTING_LEDGER = 'agm.wave2d.conversational-routing.v1';
export type RoutingSelection = { status: 'SELECTED'; capabilityId: CapabilityId } | { status: 'CONVERSATION_ONLY' } | { status: 'DENIED'; reason: 'CAPABILITY_UNAVAILABLE_OR_UNAUTHORIZED' };

export function selectConversationalCapability(decision: CopilotDecision, text: string, communicationEnabled: boolean): RoutingSelection {
  if (decision.intent === 'PHONE') return { status: 'SELECTED', capabilityId: 'OPEN_DIALER' };
  if (decision.intent === 'LOCATION') return { status: 'SELECTED', capabilityId: 'OPEN_MAPS' };
  if (decision.intent === 'COMMUNICATION' && communicationEnabled) return { status: 'SELECTED', capabilityId: /whatsapp/i.test(text) ? 'SEND_WHATSAPP' : 'SEND_EMAIL' };
  if (['GENERAL_QUESTION', 'SAFETY', 'DASHBOARD_WARNING'].includes(decision.intent)) return { status: 'CONVERSATION_ONLY' };
  return { status: 'DENIED', reason: 'CAPABILITY_UNAVAILABLE_OR_UNAUTHORIZED' };
}

export type RoutingEvent = { eventId: string; conversationId: string; requestId?: string; intent: CopilotDecision['intent']; capabilityId?: CapabilityId; stage: 'INTENT_IDENTIFIED'|'CAPABILITY_SELECTED'|'PREVIEW_PRESENTED'|'DENIED'|'CANCELLED'|'HANDOFF_RECEIPT'|'CONVERSATION_RESUMED'; outcome: string; occurredAt: string; receiptId?: string };
export class ConversationalRoutingLedger {
  constructor(private readonly storage: Pick<Storage, 'getItem'|'setItem'> = sessionStorage) {}
  record(event: Omit<RoutingEvent,'eventId'|'occurredAt'>) { const entry:RoutingEvent={...event,eventId:crypto.randomUUID(),occurredAt:new Date().toISOString()};const events=this.snapshot();events.push(entry);this.storage.setItem(WAVE_2D_ROUTING_LEDGER,JSON.stringify(events.slice(-200)));return entry; }
  recordReceipt(conversationId:string,intent:CopilotDecision['intent'],capabilityId:CapabilityId,requestId:string,receipt:HandoffReceipt){return this.record({conversationId,intent,capabilityId,requestId,stage:'HANDOFF_RECEIPT',outcome:receipt.status,receiptId:receipt.receiptId});}
  snapshot():RoutingEvent[]{try{const value=JSON.parse(this.storage.getItem(WAVE_2D_ROUTING_LEDGER)??'[]');return Array.isArray(value)?value:[];}catch{return[];}}
}
