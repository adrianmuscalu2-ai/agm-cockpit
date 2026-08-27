import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { CommunicationMessage, Prisma } from '@prisma/client';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CommunicationStatus, InboundCommunication, OutboundCommunication } from './communication.contract';
import { communicationChannels, normalizeAddress, validateOutbound } from './communication.contract';
import { CommunicationProviderRegistry } from './communication-provider.port';
import { PilotOperationsService } from '../pilot-operations/pilot-operations.service';

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService, private readonly providers: CommunicationProviderRegistry, @Optional() private readonly pilot?:PilotOperationsService) {}

  async send(value: unknown, ctx: RequestContext) {
    let input: OutboundCommunication;
    try { input = validateOutbound(value); } catch { throw new BadRequestException({ code: 'COMMUNICATION_OUTBOUND_INVALID' }); }
    const duplicate = await this.prisma.communicationMessage.findUnique({ where: { companyId_clientMessageId: { companyId: ctx.companyId, clientMessageId: input.clientMessageId } } });
    if (duplicate) return this.resource(duplicate, true);
    const provider = this.provider(input.channel);
    const now = new Date();
    const conversation = await this.findOrCreateConversation({ companyId: ctx.companyId, channel: input.channel, provider: provider.provider, participantKey: normalizeAddress(input.channel, input.to), tripId: input.tripId, lastMessageAt: now });
    const queued = await this.prisma.communicationMessage.create({ data: { companyId: ctx.companyId, conversationId: conversation.id, channel: input.channel, provider: provider.provider, direction: 'outbound', clientMessageId: input.clientMessageId, fromAddress: 'platform', toAddress: input.to, subject: input.subject, bodyText: input.bodyText, status: 'queued', occurredAt: now, statusUpdatedAt: now, createdByUserId: ctx.userId, metadata: { replyToProviderMessageId: input.replyToProviderMessageId ?? null } } });
    return this.deliver(queued, input, false);
  }

  async retry(messageId: string, ctx: RequestContext) {
    const message = await this.prisma.communicationMessage.findFirst({ where: { id: messageId, companyId: ctx.companyId } });
    if (!message) throw new NotFoundException({ code: 'COMMUNICATION_MESSAGE_NOT_FOUND' });
    if (message.direction !== 'outbound' || message.status !== 'failed') throw new ConflictException({ code: 'COMMUNICATION_RETRY_NOT_ALLOWED' });
    if (message.retryCount >= 5) throw new ConflictException({ code: 'COMMUNICATION_RETRY_EXHAUSTED' });
    if (!communicationChannels.includes(message.channel as never)) throw new ConflictException({ code: 'COMMUNICATION_CHANNEL_INVALID' });
    const metadata = (message.metadata ?? {}) as Record<string, unknown>;
    return this.deliver(message, {
      contractVersion: 'communication-message.v1',
      clientMessageId: message.clientMessageId ?? crypto.randomUUID(),
      channel: message.channel as OutboundCommunication['channel'],
      to: message.toAddress,
      subject: message.subject ?? undefined,
      bodyText: message.bodyText,
      replyToProviderMessageId: typeof metadata.replyToProviderMessageId === 'string' ? metadata.replyToProviderMessageId : undefined,
    }, false);
  }

  async ingest(input: InboundCommunication, companyId: string) {
    if (!input.providerEventId || !input.providerMessageId || !input.bodyText.trim()) throw new BadRequestException({ code: 'COMMUNICATION_INBOUND_INVALID' });
    const duplicate = await this.prisma.communicationMessage.findFirst({ where: { companyId, OR: [{ providerEventId: input.providerEventId }, { channel: input.channel, provider: input.provider, providerMessageId: input.providerMessageId }] } });
    if (duplicate) return this.resource(duplicate, true);
    const occurredAt = new Date(input.occurredAt);
    const participantKey = normalizeAddress(input.channel, input.from);
    const conversation = await this.findOrCreateConversation({ companyId, channel: input.channel, provider: input.provider, participantKey, externalThreadId: input.externalThreadId, lastMessageAt: occurredAt });
    const created = await this.prisma.communicationMessage.create({ data: { companyId, conversationId: conversation.id, channel: input.channel, provider: input.provider, direction: 'inbound', providerMessageId: input.providerMessageId, providerEventId: input.providerEventId, fromAddress: participantKey, toAddress: normalizeAddress(input.channel, input.to), subject: input.subject, bodyText: input.bodyText.trim(), status: 'received', occurredAt, statusUpdatedAt: occurredAt, metadata: (input.metadata ?? {}) as Prisma.InputJsonValue } });
    await this.prisma.communicationConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: occurredAt } });
    return this.resource(created, false);
  }

  async updateStatus(input: { provider: string; channel: 'email'|'whatsapp'; providerMessageId: string; providerEventId: string; status: CommunicationStatus; occurredAt: string }, companyId: string) {
    const message = await this.prisma.communicationMessage.findFirst({ where: { companyId, provider: input.provider, channel: input.channel, providerMessageId: input.providerMessageId } });
    if (!message) return { status: 'ignored', reason: 'MESSAGE_NOT_FOUND' };
    if (!allowedTransition(message.status, input.status)) return { status: 'ignored', reason: 'STATUS_REGRESSION' };
    const metadata = (message.metadata ?? {}) as Record<string, unknown>;
    const updated = await this.prisma.communicationMessage.update({ where: { id: message.id }, data: { status: input.status, statusUpdatedAt: new Date(input.occurredAt), lastErrorCode: input.status === 'failed' ? 'PROVIDER_DELIVERY_FAILED' : null, metadata: { ...metadata, lastStatusEventId: input.providerEventId } as Prisma.InputJsonValue } });
    return this.resource(updated, false);
  }

  async list(channel: string | undefined, ctx: RequestContext) {
    if (channel && !communicationChannels.includes(channel as never)) throw new BadRequestException({ code: 'COMMUNICATION_CHANNEL_INVALID' });
    return this.prisma.communicationConversation.findMany({ where: { companyId: ctx.companyId, ...(channel ? { channel } : {}) }, orderBy: { lastMessageAt: 'desc' }, include: { messages: { orderBy: { occurredAt: 'asc' } } } });
  }

  providerStatus(){ return this.providers.status(); }

  async syncRecent(channel: 'email'|'whatsapp', ctx: RequestContext) {
    const provider = this.provider(channel);
    if (!provider.readRecent) throw new ServiceUnavailableException({ code: 'COMMUNICATION_PROVIDER_SYNC_NOT_SUPPORTED', channel });
    let maxMessages: number | undefined;
    if(channel==='email'&&this.pilot){
      const eligibility=await this.pilot.eligibility('gmail',ctx);
      if(!eligibility.allowed)throw new ServiceUnavailableException({code:eligibility.reason,channel});
      const remaining=(eligibility.activation?.dailyRequestLimit??0)-(eligibility.used??0);
      // Reserve one request for OAuth refresh and one for the Gmail list call.
      maxMessages=Math.min(100,remaining-2);
      if(maxMessages<1)throw new ServiceUnavailableException({code:'PILOT_DAILY_REQUEST_LIMIT',channel});
    }
    const started=Date.now();
    try{
      const messages = await provider.readRecent(maxMessages);
      let ingested = 0, duplicates = 0;
      for (const message of messages) {
        const result = await this.ingest(message, ctx.companyId);
        if (result.duplicate) duplicates++; else ingested++;
      }
      const providerMetrics=provider.consumeTelemetry?.()??{requestCount:1,latencyMs:Date.now()-started,timeouts:0,rateLimitEvents:0,errors:0};
      if(channel==='email'&&this.pilot){const stale=messages.filter((message)=>Date.now()-new Date(message.occurredAt).getTime()>6*60*60_000).length;await this.pilot.recordGmailSync(ctx,{processed:messages.length,duplicates,latencyMs:Date.now()-started,backlog:0,stale});for(let index=0;index<providerMetrics.requestCount;index++)await this.pilot.record({providerId:'gmail',adapterId:'gmail.intake',category:'EMAIL',eventType:'PROVIDER_REQUEST',outcome:'SUCCESS',latencyMs:index===0?providerMetrics.latencyMs:undefined,rateLimited:index<providerMetrics.rateLimitEvents,timeout:index<providerMetrics.timeouts,metrics:{syncMessages:messages.length}},ctx);}
      return { channel, provider: provider.provider, scanned: messages.length, ingested, duplicates, providerRequests:providerMetrics.requestCount };
    }catch(error){const safe=safeError(error);const providerMetrics=provider.consumeTelemetry?.()??{requestCount:1,latencyMs:Date.now()-started,timeouts:0,rateLimitEvents:0,errors:1};if(channel==='email'&&this.pilot){await this.pilot.recordGmailSync(ctx,{processed:0,duplicates:0,latencyMs:Date.now()-started,backlog:0,stale:0,errorCode:safe});await this.pilot.record({providerId:'gmail',adapterId:'gmail.intake',category:'EMAIL',eventType:'PROVIDER_REQUEST',outcome:'ERROR',latencyMs:providerMetrics.latencyMs,rateLimited:providerMetrics.rateLimitEvents>0,timeout:providerMetrics.timeouts>0,errorCode:safe},ctx);}throw error;}
  }

  private async deliver(message: CommunicationMessage, input: OutboundCommunication, duplicate: boolean) {
    const provider = this.provider(input.channel);
    await this.prisma.communicationMessage.update({ where: { id: message.id }, data: { status: 'sending', statusUpdatedAt: new Date() } });
    try {
      const sent = await provider.send(input);
      const updated = await this.prisma.communicationMessage.update({ where: { id: message.id }, data: { providerMessageId: sent.providerMessageId, status: sent.status, statusUpdatedAt: new Date(), lastErrorCode: null } });
      if (sent.externalThreadId) await this.prisma.communicationConversation.update({ where: { id: message.conversationId }, data: { externalThreadId: sent.externalThreadId, lastMessageAt: new Date() } });
      return this.resource(updated, duplicate);
    } catch (error) {
      const failed = await this.prisma.communicationMessage.update({ where: { id: message.id }, data: { status: 'failed', statusUpdatedAt: new Date(), retryCount: { increment: 1 }, lastErrorCode: safeError(error) } });
      return this.resource(failed, duplicate);
    }
  }

  private provider(channel: 'email'|'whatsapp') {
    try { return this.providers.for(channel); } catch { throw new ServiceUnavailableException({ code: 'COMMUNICATION_PROVIDER_NOT_CONFIGURED', channel }); }
  }

  private async findOrCreateConversation(input: { companyId: string; channel: string; provider: string; participantKey: string; externalThreadId?: string; tripId?: string; lastMessageAt: Date }) {
    const existing = await this.prisma.communicationConversation.findFirst({ where: { companyId: input.companyId, channel: input.channel, provider: input.provider, OR: [...(input.externalThreadId ? [{ externalThreadId: input.externalThreadId }] : []), { participantKey: input.participantKey, status: 'open' }] } });
    return existing ?? this.prisma.communicationConversation.create({ data: input });
  }

  private resource(message: CommunicationMessage, duplicate: boolean) { return { id: message.id, conversationId: message.conversationId, channel: message.channel, direction: message.direction, status: message.status, occurredAt: message.occurredAt, duplicate }; }
}

function safeError(error: unknown) { const value = error instanceof Error ? error.message : 'UNKNOWN'; return value.split(':')[0].replace(/[^A-Z0-9_-]/gi, '_').slice(0, 80); }
const rank: Record<string, number> = { queued: 0, sending: 1, sent: 2, delivered: 3, read: 4, failed: 5 };
function allowedTransition(current: string, next: string) { return next === 'failed' || (rank[next] ?? -1) >= (rank[current] ?? -1); }
