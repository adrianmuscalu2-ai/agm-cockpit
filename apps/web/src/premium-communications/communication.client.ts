export type CommunicationChannel = 'email' | 'whatsapp';
export type CommunicationStatus = 'received' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'conflict';

export type CommunicationDraft = {
  channel: CommunicationChannel;
  to: string;
  subject?: string;
  bodyText: string;
  tripId?: string;
  replyToProviderMessageId?: string;
};

export type CommunicationMessage = CommunicationDraft & {
  id: string;
  direction: 'inbound' | 'outbound';
  status: CommunicationStatus;
  occurredAt: string;
};

export type CommunicationTimelineSink = (event: {
  type: 'communication.sent' | 'communication.received' | 'communication.failed';
  tripId?: string;
  channel: CommunicationChannel;
  messageId: string;
  occurredAt: string;
}) => Promise<void> | void;

export class CommunicationClient {
  constructor(
    private readonly apiBase: string,
    private readonly token: () => string | null,
    private readonly timeline?: CommunicationTimelineSink,
    private readonly request: typeof fetch = fetch,
  ) {}

  async send(draft: CommunicationDraft) {
    const message = await this.call<CommunicationMessage>('/communications/messages', {
      method: 'POST',
      body: JSON.stringify({ message: { contractVersion: 'communication-message.v1', clientMessageId: crypto.randomUUID(), ...draft } }),
    });
    await this.timeline?.({ type: message.status === 'failed' ? 'communication.failed' : 'communication.sent', tripId: draft.tripId, channel: draft.channel, messageId: message.id, occurredAt: message.occurredAt });
    return message;
  }

  async conversations(channel?: CommunicationChannel) {
    const suffix = channel ? `?channel=${channel}` : '';
    return this.call<Array<{ id: string; channel: CommunicationChannel; tripId?: string; messages: CommunicationMessage[] }>>(`/communications/conversations${suffix}`);
  }

  async retry(messageId: string) {
    return this.call<CommunicationMessage>(`/communications/messages/${encodeURIComponent(messageId)}/retry`, { method: 'POST' });
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.token();
    if (!token) throw new Error('COMMUNICATION_AUTH_REQUIRED');
    const response = await this.request(`${this.apiBase}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers } });
    if (!response.ok) throw new Error(`COMMUNICATION_API_FAILED:${response.status}`);
    const envelope = await response.json() as { data: T };
    return envelope.data;
  }
}
