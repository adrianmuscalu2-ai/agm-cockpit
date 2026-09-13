import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { GmailCommunicationProvider, GmailProviderError } from '../src/communications/providers/gmail.provider';
import { composeGmailAnswer, PremiumAssistantGmailService } from '../src/premium-assistant/premium-assistant-gmail.service';

async function main() {
  const originalFetch = global.fetch;
  const requestedHosts: string[] = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedHosts.push(new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).hostname);
    return originalFetch(input, init);
  }) as typeof fetch;
  try {
    const config = new ConfigService(process.env);
    const firstProvider = new GmailCommunicationProvider(config);
    assert.equal(firstProvider.configured(), true, 'GMAIL_NOT_CONFIGURED');
    const recent = await firstProvider.searchInbox('', 3);
    assert.ok(recent.length > 0, 'REAL_GMAIL_INBOX_EMPTY');
    const newest = recent[0]!;
    assert.ok(newest.id && newest.from && newest.subject && newest.occurredAt, 'REAL_GMAIL_MESSAGE_METADATA_MISSING');
    assert.ok(newest.bodyText.trim().length > 0, 'REAL_GMAIL_MESSAGE_BODY_MISSING');

    const senderAddress = newest.from.match(/<([^>]+)>/)?.[1] ?? newest.from.match(/[^\s<>]+@[^\s<>]+/)?.[0];
    assert.ok(senderAddress, 'REAL_GMAIL_SENDER_ADDRESS_MISSING');
    const senderMatches = await firstProvider.searchInbox(`from:${senderAddress}`, 3);
    assert.ok(senderMatches.some((message) => message.id === newest.id), 'REAL_GMAIL_SENDER_SEARCH_FAILED');
    const thread = newest.threadId ? await firstProvider.readThread(newest.threadId) : [];
    assert.ok(!newest.threadId || thread.some((message) => message.id === newest.id), 'REAL_GMAIL_THREAD_READ_FAILED');

    const firstTool = new PremiumAssistantGmailService(firstProvider);
    const summary = await firstTool.retrieve('Rezuma ultimele trei e-mailuri');
    const answer = composeGmailAnswer(summary, 'ro');
    assert.ok(answer.length > 40, 'CONTEXTUAL_ANSWER_MISSING');
    assert.ok(!/gmail:message:|GMAIL-[A-Za-z0-9_-]+|https?:\/\//i.test(answer), 'PRIVATE_SOURCE_LEAKED_TO_USER_TEXT');
    assert.equal(summary.sources.every((source) => source.originType === 'GMAIL' && source.urlOrIdentifier?.startsWith('gmail:message:')), true);

    const restartTool = new PremiumAssistantGmailService(new GmailCommunicationProvider(new ConfigService(process.env)));
    const afterRestart = await restartTool.retrieve('Rezuma ultimul e-mail');
    assert.ok(afterRestart.messages.length === 1, 'RESTART_REFRESH_READ_FAILED');

    const controlledFailureProvider = new GmailCommunicationProvider(new ConfigService({ GMAIL_FROM_ADDRESS: process.env.GMAIL_FROM_ADDRESS, GMAIL_ACCESS_TOKEN: 'controlled-invalid-access-token' }));
    await assert.rejects(() => controlledFailureProvider.searchInbox('', 1), (error: unknown) => error instanceof GmailProviderError && error.code === 'AUTHORIZATION_FAILED');
    assert.equal(requestedHosts.every((host) => host === 'oauth2.googleapis.com' || host === 'gmail.googleapis.com'), true, 'NON_GMAIL_EGRESS_DETECTED');

    console.log(JSON.stringify({
      verdict: 'GMAIL_ASSISTANT_REAL_E2E_PASS',
      oauthRefresh: requestedHosts.includes('oauth2.googleapis.com'),
      realInboxSearch: true,
      realSenderSearch: true,
      realMessageRead: true,
      realThreadRead: newest.threadId ? true : 'NOT_APPLICABLE',
      contextualAnswer: true,
      userVisibleSourcesAbsent: true,
      engineeringSourceTrace: summary.sources.length,
      freshProcessRefreshAndRead: true,
      controlledAuthFailure: true,
      noWebFallback: true,
      onlyGoogleGmailHosts: true,
      secretsPrinted: false,
      privateMessageContentPrinted: false,
    }));
  } finally {
    global.fetch = originalFetch;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'GMAIL_ASSISTANT_REAL_E2E_FAILED');
  process.exitCode = 1;
});
