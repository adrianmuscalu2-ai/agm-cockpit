import { classifyGmailIntent, extractGmailActionContext } from '../src/premium-assistant/premium-assistant-gmail.service';

describe('Gmail action context extraction', () => {
  it('keeps the post-retrieval navigation clause out of the Gmail sender query', () => {
    expect(classifyGmailIntent('Citește ultimul mail de la dispecerat și deschide adresa de descărcare.')).toMatchObject({
      operation: 'LATEST_FROM', gmailQuery: 'from:dispecerat', maxMessages: 1,
    });
  });

  it('extracts action candidates separately from the natural answer', () => {
    const value = extractGmailActionContext({
      id:'provider-message-id',threadId:'thread-1',from:'Dispatch <dispatch@example.com>',to:'driver@example.com',subject:'Descărcare',occurredAt:'2026-09-13T08:00:00.000Z',attachments:[],
      bodyText:'Adresa de descărcare: Industriestrasse 10, 74072 Heilbronn\nTelefon: +49 7131 123456\nProgramare: 14.09.2026 08:30',
    });
    expect(value.messageRef).toMatch(/^GMAIL-[a-f0-9]{20}$/);
    expect(value.senderEmail).toBe('dispatch@example.com');
    expect(value.destinations.join(' ')).toContain('74072 Heilbronn');
    expect(value.phoneNumbers[0]).toContain('7131');
    expect(value.dateTimes[0]).toBe('2026-09-14T06:30:00.000Z');
  });

  it('does not expose an impossible local appointment to Calendar', () => {
    const value = extractGmailActionContext({
      id:'invalid-date',threadId:'thread-2',from:'Dispatch <dispatch@example.com>',to:'driver@example.com',subject:'Programare',occurredAt:'2026-09-13T08:00:00.000Z',attachments:[],
      bodyText:'Programare: 31.02.2026 08:30',
    });
    expect(value.dateTimes).toEqual([]);
  });
});
