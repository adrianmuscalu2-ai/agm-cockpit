import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyOfferCorrelation, parsePlatformOffer } from '../src/car-mover/car-mover.service';
import { createHash } from 'node:crypto';
import { normalizeOpportunity } from '../src/opportunity-intelligence/opportunity-intelligence.engine';

describe('Gmail live intake pilot contract', () => {
  it('GMAIL-01 extracts a complete Car Mover offer for human review', () => {
    const parsed = parsePlatformOffer('Order: FR-812\nFrom Munich to Strasbourg\nVehicle: BMW 3\n420 EUR\n390 km', 'gmail', 'offers@example.test');
    expect(parsed).toMatchObject({ isOffer: true, externalReference: 'FR-812', pickupLabel: 'Munich', destinationLabel: 'Strasbourg', offeredAmount: '420', currencyCode: 'EUR' });
  });

  it.each([
    ['incomplete', 'Transport request, price 300 EUR'],
    ['unclear', 'Could you please call me about tomorrow?'],
    ['irrelevant', 'Your monthly account statement is available.'],
  ])('GMAIL-02 rejects %s email without inventing an opportunity', (_label, text) => {
    expect(parsePlatformOffer(text, 'gmail', 'sender@example.test').isOffer).toBe(false);
  });

  it('GMAIL-03 retains the commercial reference and detects a changed payload', () => {
    const originalText = 'Order: FR-812\nFrom Munich to Strasbourg\n420 EUR';
    const updatedText = 'Order: FR-812\nFrom Munich to Strasbourg\n450 EUR\nCondition: pickup before 15:00';
    const original = parsePlatformOffer(originalText, 'gmail', 'offers@example.test');
    const updated = parsePlatformOffer(updatedText, 'gmail', 'offers@example.test');
    expect(updated.externalReference).toBe(original.externalReference);
    expect(createHash('sha256').update(updatedText).digest('hex')).not.toBe(createHash('sha256').update(originalText).digest('hex'));
  });

  it('GMAIL-03A eliminates repeated offers even when the email timestamp changes', () => {
    expect(classifyOfferCorrelation('same-hash',new Date('2026-08-24T10:00:00Z'),new Date('2026-08-24T11:00:00Z'),'same-hash')).toBe('DUPLICATE');
  });

  it('GMAIL-03B versions a newer price/condition update and ignores an older replay', () => {
    const current=new Date('2026-08-24T11:00:00Z');
    expect(classifyOfferCorrelation('old-hash',current,new Date('2026-08-24T11:30:00Z'),'new-hash')).toBe('UPDATE');
    expect(classifyOfferCorrelation('new-hash',new Date('2026-08-24T11:30:00Z'),current,'old-hash')).toBe('OUTDATED_DUPLICATE');
  });

  it('GMAIL-04 correlates the same opportunity across Gmail and another channel', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    const base = { platform: 'Onlogist', pickupLocation: 'Munich', deliveryLocation: 'Strasbourg', priceAmount: 420, currencyCode: 'EUR', sourceTimestamp: '2026-08-24T11:00:00.000Z' };
    const gmail = normalizeOpportunity({ ...base, sourceOpportunityId: 'gmail-812' }, now);
    const platform = normalizeOpportunity({ ...base, sourceOpportunityId: 'platform-999' }, now);
    expect(platform.correlationKey).toBe(gmail.correlationKey);
  });

  it('GMAIL-05 preserves the Human Decide boundary and cannot create a Job automatically', () => {
    const source = readFileSync(join(process.cwd(), 'src/car-mover/car-mover.service.ts'), 'utf8');
    const analyzeBody = source.slice(source.indexOf('async analyzeInboundOffers('), source.indexOf('async listOffers('));
    expect(analyzeBody).not.toContain('carMoverJob.create');
    expect(analyzeBody).not.toContain('this.create(');
  });
});
