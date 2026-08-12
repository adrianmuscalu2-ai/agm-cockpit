export type AlertChannel = 'email' | 'whatsapp';
export type ProviderState = 'DISCONNECTED' | 'AUTHORIZATION_PENDING' | 'CONNECTED';

export type VerifiedMessageEvent = {
  eventId: string;
  channel: AlertChannel;
  providerMessageId: string;
  receivedAt: string;
};

export type CommunicationAlertState = {
  channel: AlertChannel;
  providerState: ProviderState;
  unreadCount: number;
  lastVerifiedEventAt?: string;
};

export function initialAlertState(channel: AlertChannel, providerState: ProviderState): CommunicationAlertState {
  return { channel, providerState, unreadCount: 0 };
}

export function applyVerifiedMessageEvent(state: CommunicationAlertState, event: VerifiedMessageEvent): CommunicationAlertState {
  if (state.providerState !== 'CONNECTED' || event.channel !== state.channel || !event.eventId.trim() || !event.providerMessageId.trim()) return state;
  return { ...state, unreadCount: state.unreadCount + 1, lastVerifiedEventAt: event.receivedAt };
}
