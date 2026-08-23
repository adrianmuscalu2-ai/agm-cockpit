import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InboundCommunication, OutboundCommunication } from '../communication.contract';
import type { CommunicationProviderPort, ProviderSendResult } from '../communication-provider.port';

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
};

@Injectable()
export class GmailCommunicationProvider implements CommunicationProviderPort {
  readonly channel = 'email' as const;
  readonly provider = 'gmail';

  constructor(private readonly config: ConfigService) {}

  private cachedToken?: { value: string; expiresAt: number };

  configured() {
    const staticToken = this.config.get<string>('GMAIL_ACCESS_TOKEN');
    const refreshFlow = this.config.get<string>('GMAIL_OAUTH_CLIENT_ID') && this.config.get<string>('GMAIL_OAUTH_CLIENT_SECRET') && this.config.get<string>('GMAIL_OAUTH_REFRESH_TOKEN');
    return Boolean(this.config.get<string>('GMAIL_FROM_ADDRESS') && (staticToken || refreshFlow));
  }

  async send(message: OutboundCommunication): Promise<ProviderSendResult> {
    if (!this.configured()) throw new Error('COMMUNICATION_PROVIDER_NOT_CONFIGURED:email');
    const from = this.config.getOrThrow<string>('GMAIL_FROM_ADDRESS');
    const subject = (message.subject ?? 'AGM').replace(/[\r\n]/g, ' ');
    const raw = Buffer.from([
      `From: ${from}`,
      `To: ${message.to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      message.bodyText,
    ].join('\r\n')).toString('base64url');
    const response = await this.gmail('/messages/send', { method: 'POST', body: JSON.stringify({ raw, threadId: message.replyToProviderMessageId }) });
    const body = await response.json() as { id?: string; threadId?: string };
    if (!body.id) throw new Error('GMAIL_SEND_INVALID_RESPONSE');
    return { providerMessageId: body.id, externalThreadId: body.threadId, status: 'sent' };
  }

  async readHistory(historyId: string, pushEventId: string): Promise<InboundCommunication[]> {
    if (!this.configured()) throw new Error('COMMUNICATION_PROVIDER_NOT_CONFIGURED:email');
    const response = await this.gmail(`/history?startHistoryId=${encodeURIComponent(historyId)}&historyTypes=messageAdded`);
    const history = await response.json() as { history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }> };
    const ids = [...new Set((history.history ?? []).flatMap((item) => item.messagesAdded ?? []).map((item) => item.message?.id).filter((id): id is string => Boolean(id)))];
    return Promise.all(ids.map(async (id) => this.toInbound(await this.getMessage(id), pushEventId)));
  }

  async readRecent(): Promise<InboundCommunication[]> {
    if (!this.configured()) throw new Error('COMMUNICATION_PROVIDER_NOT_CONFIGURED:email');
    const query = encodeURIComponent('in:inbox newer_than:14d');
    const response = await this.gmail(`/messages?q=${query}&maxResults=100`);
    const list = await response.json() as { messages?: Array<{ id?: string }> };
    const ids = [...new Set((list.messages ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))];
    return Promise.all(ids.map(async (id) => this.toInbound(await this.getMessage(id), `gmail-sync:${id}`)));
  }

  private async getMessage(id: string) {
    const response = await this.gmail(`/messages/${encodeURIComponent(id)}?format=full`);
    return response.json() as Promise<GmailMessage>;
  }

  private toInbound(message: GmailMessage, pushEventId: string): InboundCommunication {
    const headers = new Map((message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]));
    return {
      contractVersion: 'communication-message.v1',
      provider: 'gmail',
      providerEventId: `${pushEventId}:${message.id}`,
      providerMessageId: message.id,
      externalThreadId: message.threadId,
      channel: 'email',
      from: emailAddress(headers.get('from') ?? ''),
      to: emailAddress(headers.get('to') ?? this.config.getOrThrow<string>('GMAIL_FROM_ADDRESS')),
      subject: headers.get('subject'),
      bodyText: plainText(message.payload).trim(),
      occurredAt: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
      metadata: { gmailLabelsPreserved: true },
    };
  }

  private async gmail(path: string, init?: RequestInit) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json', ...init?.headers },
    });
    if (!response.ok) throw new Error(`GMAIL_API_FAILED:${response.status}`);
    return response;
  }

  private async accessToken() {
    const staticToken = this.config.get<string>('GMAIL_ACCESS_TOKEN');
    if (staticToken) return staticToken;
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) return this.cachedToken.value;
    const body = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GMAIL_OAUTH_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('GMAIL_OAUTH_CLIENT_SECRET'),
      refresh_token: this.config.getOrThrow<string>('GMAIL_OAUTH_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    });
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) throw new Error(`GMAIL_OAUTH_REFRESH_FAILED:${response.status}`);
    const token = await response.json() as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new Error('GMAIL_OAUTH_REFRESH_INVALID_RESPONSE');
    this.cachedToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
    return token.access_token;
  }
}

function plainText(part?: GmailPart): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) return Buffer.from(part.body.data, 'base64url').toString('utf8');
  return (part.parts ?? []).map(plainText).filter(Boolean).join('\n');
}

function emailAddress(value: string) {
  return value.match(/<([^>]+)>/)?.[1]?.trim().toLowerCase() ?? value.trim().toLowerCase();
}
