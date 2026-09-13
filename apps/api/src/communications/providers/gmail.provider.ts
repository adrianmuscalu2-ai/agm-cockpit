import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InboundCommunication, OutboundCommunication } from '../communication.contract';
import type { CommunicationProviderPort, CommunicationProviderTelemetry, ProviderSendResult } from '../communication-provider.port';

type GmailPart = { mimeType?: string; filename?: string; body?: { data?: string; attachmentId?: string; size?: number }; parts?: GmailPart[] };
type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
};

export type GmailInboxMessage = {
  id: string;
  threadId: string | null;
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  occurredAt: string;
  attachments: Array<{ filename: string; mimeType: string; size: number | null; attachmentId: string | null }>;
};

export class GmailProviderError extends Error {
  constructor(readonly code: 'NOT_CONFIGURED' | 'AUTHORIZATION_FAILED' | 'API_FAILED', readonly status?: number, readonly reason?: string) {
    super(`GMAIL_${code}${status ? `:${status}` : ''}${reason ? `:${reason}` : ''}`);
  }
}

@Injectable()
export class GmailCommunicationProvider implements CommunicationProviderPort {
  readonly channel = 'email' as const;
  readonly provider = 'gmail';

  constructor(private readonly config: ConfigService) {}

  private cachedToken?: { value: string; expiresAt: number };
  private telemetry:CommunicationProviderTelemetry={requestCount:0,latencyMs:0,timeouts:0,rateLimitEvents:0,errors:0};

  consumeTelemetry(){const value={...this.telemetry};this.telemetry={requestCount:0,latencyMs:0,timeouts:0,rateLimitEvents:0,errors:0};return value;}

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

  async readRecent(maxMessages = 100): Promise<InboundCommunication[]> {
    if (!this.configured()) throw new Error('COMMUNICATION_PROVIDER_NOT_CONFIGURED:email');
    const query = encodeURIComponent('in:inbox newer_than:14d');
    const safeLimit = Math.max(1, Math.min(100, Math.floor(maxMessages)));
    const response = await this.gmail(`/messages?q=${query}&maxResults=${safeLimit}`);
    const list = await response.json() as { messages?: Array<{ id?: string }> };
    const ids = [...new Set((list.messages ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))];
    return mapWithConcurrency(ids, 5, async (id) => this.toInbound(await this.getMessage(id), `gmail-sync:${id}`));
  }

  async searchInbox(query: string, maxMessages = 10): Promise<GmailInboxMessage[]> {
    if (!this.configured()) throw new GmailProviderError('NOT_CONFIGURED');
    const safeLimit = Math.max(1, Math.min(25, Math.floor(maxMessages)));
    const gmailQuery = ['in:inbox', query.trim()].filter(Boolean).join(' ');
    const response = await this.gmail(`/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=${safeLimit}`);
    const list = await response.json() as { messages?: Array<{ id?: string }> };
    const ids = (list.messages ?? []).map((item) => item.id).filter((id): id is string => Boolean(id));
    return mapWithConcurrency(ids, 5, async (id) => this.toInboxMessage(await this.getMessage(id)));
  }

  async readThread(threadId: string): Promise<GmailInboxMessage[]> {
    if (!this.configured()) throw new GmailProviderError('NOT_CONFIGURED');
    const response = await this.gmail(`/threads/${encodeURIComponent(threadId)}?format=full`);
    const value = await response.json() as { messages?: GmailMessage[] };
    return (value.messages ?? []).map((message) => this.toInboxMessage(message));
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

  private toInboxMessage(message: GmailMessage): GmailInboxMessage {
    const headers = new Map((message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]));
    return {
      id: message.id,
      threadId: message.threadId ?? null,
      from: headers.get('from')?.trim() ?? '',
      to: headers.get('to')?.trim() ?? '',
      subject: headers.get('subject')?.trim() ?? '(no subject)',
      bodyText: messageText(message.payload).trim(),
      occurredAt: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
      attachments: attachmentMetadata(message.payload),
    };
  }

  private async gmail(path: string, init?: RequestInit) {
    const request = async () => this.trackedFetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json', ...init?.headers },
    });
    let response = await request();
    if (response.status === 401 && !this.config.get<string>('GMAIL_ACCESS_TOKEN')) {
      this.cachedToken = undefined;
      response = await request();
    }
    if (!response.ok) throw new GmailProviderError(response.status === 401 || response.status === 403 ? 'AUTHORIZATION_FAILED' : 'API_FAILED', response.status);
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
    const response = await this.trackedFetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { error?: string };
      const safeReason = ['invalid_grant', 'invalid_client', 'unauthorized_client', 'invalid_request'].includes(failure.error ?? '') ? failure.error : undefined;
      throw new GmailProviderError('AUTHORIZATION_FAILED', response.status, safeReason);
    }
    const token = await response.json() as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new GmailProviderError('AUTHORIZATION_FAILED');
    this.cachedToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
    return token.access_token;
  }

  private async trackedFetch(url:string,init:RequestInit){const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8_000);this.telemetry.requestCount++;try{const response=await fetch(url,{...init,signal:controller.signal});if(response.status===429)this.telemetry.rateLimitEvents++;if(!response.ok)this.telemetry.errors++;return response;}catch(error){this.telemetry.errors++;if((error as Error).name==='AbortError')this.telemetry.timeouts++;throw error;}finally{this.telemetry.latencyMs+=Date.now()-started;clearTimeout(timer);}}
}

function plainText(part?: GmailPart): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) return Buffer.from(part.body.data, 'base64url').toString('utf8');
  return (part.parts ?? []).map(plainText).filter(Boolean).join('\n');
}

function messageText(part?: GmailPart): string {
  const plain = plainText(part).trim();
  if (plain) return plain;
  const html = htmlText(part).trim();
  return html
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function htmlText(part?: GmailPart): string {
  if (!part) return '';
  if (part.mimeType === 'text/html' && part.body?.data) return Buffer.from(part.body.data, 'base64url').toString('utf8');
  return (part.parts ?? []).map(htmlText).filter(Boolean).join('\n');
}

function attachmentMetadata(part?: GmailPart): GmailInboxMessage['attachments'] {
  if (!part) return [];
  const own = part.filename?.trim() ? [{
    filename: part.filename.trim(),
    mimeType: part.mimeType ?? 'application/octet-stream',
    size: typeof part.body?.size === 'number' ? part.body.size : null,
    attachmentId: part.body?.attachmentId ?? null,
  }] : [];
  return [...own, ...(part.parts ?? []).flatMap(attachmentMetadata)];
}

function emailAddress(value: string) {
  return value.match(/<([^>]+)>/)?.[1]?.trim().toLowerCase() ?? value.trim().toLowerCase();
}

async function mapWithConcurrency<T, R>(values: readonly T[], concurrency: number, mapper: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await mapper(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
