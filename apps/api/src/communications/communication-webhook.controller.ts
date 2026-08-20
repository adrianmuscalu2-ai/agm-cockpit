import { BadRequestException, Controller, Get, Headers, Post, Query, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { InboundCommunication } from './communication.contract';
import { CommunicationService } from './communication.service';
import { GmailCommunicationProvider } from './providers/gmail.provider';
import { parseGmailPush, parseWhatsAppWebhook, verifyHmacSha256 } from './webhook.parsers';

@Controller('webhooks/communications')
export class CommunicationWebhookController {
  constructor(
    private readonly service: CommunicationService,
    private readonly config: ConfigService,
    private readonly gmail: GmailCommunicationProvider,
  ) {}

  @Get('whatsapp')
  verifyWhatsApp(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    if (mode !== 'subscribe' || !challenge || token !== this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN')) throw new UnauthorizedException();
    return challenge;
  }

  @Post('whatsapp')
  async whatsapp(@Req() request: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature?: string) {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret || !request.rawBody || !verifyHmacSha256(request.rawBody, signature, secret)) throw new UnauthorizedException();
    const accountId = whatsappAccountId(request.body);
    const companyId = this.companyFor('whatsapp', accountId);
    const parsed = parseWhatsAppWebhook(request.body);
    for (const message of parsed.inbound) await this.service.ingest(message, companyId);
    for (const status of parsed.statuses) await this.service.updateStatus({ ...status, provider: 'whatsapp-cloud', channel: 'whatsapp' }, companyId);
    return { received: true, inbound: parsed.inbound.length, statuses: parsed.statuses.length };
  }

  @Post('email')
  async email(@Req() request: RawBodyRequest<Request>, @Headers('x-agm-signature-256') signature?: string) {
    const secret = this.config.get<string>('EMAIL_INBOUND_WEBHOOK_SECRET');
    if (!secret || !request.rawBody || !verifyHmacSha256(request.rawBody, signature, secret)) throw new UnauthorizedException();
    const body = request.body as InboundCommunication;
    if (body.provider !== 'gmail' || body.channel !== 'email') throw new BadRequestException();
    const companyId = this.companyFor('gmail', body.to);
    return { received: true, message: await this.service.ingest(body, companyId) };
  }

  @Post('gmail-push')
  async gmailPush(@Req() request: Request, @Query('token') queryToken?: string, @Headers('x-agm-pubsub-token') headerToken?: string) {
    const expected = this.config.get<string>('GMAIL_PUBSUB_VERIFICATION_TOKEN');
    const token = headerToken ?? queryToken;
    if (!expected || !token || token !== expected) throw new UnauthorizedException();
    const accountId = this.config.get<string>('GMAIL_USER_EMAIL');
    const companyId = this.companyFor('gmail', accountId);
    const notification = parseGmailPush(request.body);
    const eventId = String((request.body as { message?: { messageId?: string } })?.message?.messageId ?? notification.historyId);
    const messages = await this.gmail.readHistory(notification.historyId, eventId);
    for (const message of messages) await this.service.ingest(message, companyId);
    return { received: true, historyId: notification.historyId, inbound: messages.length };
  }

  private companyFor(provider: 'gmail' | 'whatsapp', accountId: string | undefined) {
    if (!accountId?.trim()) throw new UnauthorizedException('PROVIDER_ACCOUNT_UNMAPPED');
    const raw = this.config.get<string>('COMMUNICATION_TENANT_MAP_JSON');
    if (raw) {
      try {
        const map = JSON.parse(raw) as Record<string, string>;
        const companyId = map[`${provider}:${accountId.trim().toLowerCase()}`];
        if (companyId) return companyId;
      } catch {
        throw new UnauthorizedException('TENANT_MAP_INVALID');
      }
    }
    if (this.config.get<string>('COMMUNICATION_SINGLE_TENANT_MODE') === 'true') {
      const companyId = this.config.get<string>('COMMUNICATION_COMPANY_ID');
      if (companyId) return companyId;
    }
    throw new UnauthorizedException('PROVIDER_ACCOUNT_UNMAPPED');
  }
}

function whatsappAccountId(body: unknown): string | undefined {
  const value = body as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }> };
  return value.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
}
