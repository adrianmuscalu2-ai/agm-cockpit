import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PremiumAssistantLibraryService } from '../src/premium-assistant/premium-assistant-library.service';
import { PremiumAssistantService } from '../src/premium-assistant/premium-assistant.service';
import {
  OCR_ARCHIVE_RESOLVER_ID,
  PERSISTENT_HISTORY_RESOLVER_ID,
  SHARED_ARCHIVE_RESOLVER_ID,
  TRANSLATION_ARCHIVE_RESOLVER_ID,
  classifyOcrArchiveIntent,
  classifySharedArchiveIntent,
  classifyTranslationArchiveIntent,
} from '../src/premium-assistant/shared-archive-library.resolver';
import { SharedArchiveService } from '../src/shared-archive/shared-archive.service';

const NOW = new Date('2026-09-19T12:00:00.000Z');
const owner = { userId: 'owner-1', companyId: 'tenant-1', roles: ['PREMIUM_ACCESS'], requestId: 'request-2c', correlationId: 'correlation-2c' };
const otherOwner = { ...owner, userId: 'owner-2' };

function archiveDto(overrides: Record<string, unknown> = {}) {
  return {
    recordId: randomUUID(), category: 'TRANSLATION' as const, namespace: 'agm.translation.user-approved',
    title: 'Traducere Clicktrans', payload: { sourceText: 'Oferta Clicktrans', translatedText: 'Clicktrans offer' },
    searchText: 'Oferta Clicktrans Clicktrans offer', syncPolicy: 'SYNC_ALLOWED' as const,
    persistence: 'USER_APPROVED_PERSISTENT' as const, sourceSurface: 'ANDROID' as const,
    userApprovedAt: NOW.toISOString(), approvalEvidence: 'TRANSLATOR_ARCHIVE_BUTTON', observedAt: NOW.toISOString(),
    ...overrides,
  };
}

function memoryPrisma() {
  const rows: any[] = [];
  const delegate = {
    create: jest.fn(async ({ data }: any) => {
      const createdAt = new Date();
      const row = { id: data.id ?? randomUUID(), ...data, payload: data.payload ?? null, revokedAt: null, revocationReason: null, deletedAt: null, createdAt, updatedAt: createdAt };
      rows.push(row);
      return row;
    }),
    findMany: jest.fn(async ({ where }: any) => {
      return rows.filter((row) =>
        row.companyId === where.companyId && row.ownerUserId === where.ownerUserId
        && row.revokedAt === null && row.deletedAt === null
        && (!where.category || row.category === where.category)
        && (!where.OR || where.OR.some((condition: any) => row.searchText.includes(condition.searchText.contains)))
        && (!where.observedAt?.gte || row.observedAt >= where.observedAt.gte)
        && (!where.observedAt?.lte || row.observedAt <= where.observedAt.lte));
    }),
    findFirst: jest.fn(async ({ where }: any) => rows.find((row) => row.id === where.id && row.companyId === where.companyId && row.ownerUserId === where.ownerUserId && row.revokedAt === null && row.deletedAt === null) ?? null),
    update: jest.fn(async ({ where, data }: any) => {
      const row = rows.find((candidate) => candidate.id === where.id);
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    }),
  };
  return { rows, delegate, prisma: { agmSharedArchiveRecord: delegate } };
}

describe('Phase 2C storage policy and authorized shared backend', () => {
  it('rejects LOCAL_ONLY and non-approved persistence before any database write', async () => {
    const store = memoryPrisma();
    const service = new SharedArchiveService(store.prisma as never);
    await expect(service.create(owner, archiveDto({ syncPolicy: 'LOCAL_ONLY' }) as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(owner, archiveDto({ persistence: 'EPHEMERAL_SESSION' }) as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(owner, archiveDto({ userApprovedAt: undefined }) as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(store.delegate.create).not.toHaveBeenCalled();
  });

  it('authorizes identity before all reads and writes', async () => {
    const store = memoryPrisma();
    const service = new SharedArchiveService(store.prisma as never);
    await expect(service.create({ ...owner, userId: '' }, archiveDto() as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.query({ ...owner, companyId: '' }, { query: 'Clicktrans', requestSurface: 'BROWSER' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.delegate.create).not.toHaveBeenCalled();
    expect(store.delegate.findMany).not.toHaveBeenCalled();
  });

  it('syncs Android to Browser and Browser to Android through one owner-scoped backend', async () => {
    const store = memoryPrisma();
    const service = new SharedArchiveService(store.prisma as never);
    await service.create(owner, archiveDto({ sourceSurface: 'ANDROID' }) as never);
    await service.create(owner, archiveDto({ recordId: randomUUID(), sourceSurface: 'BROWSER', title: 'Traducere Mona', searchText: 'Mona contract', payload: { sourceText: 'contract', translatedText: 'Vertrag' } }) as never);
    const fromBrowser = await service.query(owner, { query: 'Clicktrans', category: 'TRANSLATION', requestSurface: 'BROWSER' });
    const fromAndroid = await service.query(owner, { query: 'Mona', category: 'TRANSLATION', requestSurface: 'ANDROID' });
    expect(fromBrowser).toEqual([expect.objectContaining({ sourceSurface: 'ANDROID', title: 'Traducere Clicktrans' })]);
    expect(fromAndroid).toEqual([expect.objectContaining({ sourceSurface: 'BROWSER', title: 'Traducere Mona' })]);
    expect(await service.query(otherOwner, { query: 'Clicktrans', requestSurface: 'BROWSER' })).toEqual([]);
  });

  it('excludes revoked and deleted records from both surfaces', async () => {
    const store = memoryPrisma();
    const service = new SharedArchiveService(store.prisma as never);
    const revoked = await service.create(owner, archiveDto() as never);
    await service.revoke(owner, revoked.id, 'User revoked archive access');
    expect(await service.query(owner, { query: 'Clicktrans', requestSurface: 'BROWSER' })).toEqual([]);

    const deleted = await service.create(owner, archiveDto({ recordId: randomUUID() }) as never);
    await service.delete(owner, deleted.id);
    expect(await service.query(owner, { query: 'Clicktrans', requestSurface: 'ANDROID' })).toEqual([]);
    expect(store.rows.find((row) => row.id === deleted.id)).toMatchObject({ title: '[deleted]', searchText: '', deletedAt: expect.any(Date) });
  });

  it('refuses binary images and credential-like payloads in persistent evidence', async () => {
    const store = memoryPrisma();
    const service = new SharedArchiveService(store.prisma as never);
    await expect(service.create(owner, archiveDto({ payload: { image: 'data:image/png;base64,abc' } }) as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(owner, archiveDto({ payload: { accessToken: 'do-not-store' } }) as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(store.delegate.create).not.toHaveBeenCalled();
  });
});

describe('Phase 2C intent, resolution, and Assistant boundary', () => {
  it.each([
    ['Folosește traducerea pe care am făcut-o ieri.', classifyTranslationArchiveIntent],
    ['Care a fost ultima traducere pentru clientul Clicktrans?', classifyTranslationArchiveIntent],
    ['Ce document am scanat despre CMR?', classifyOcrArchiveIntent],
    ['Găsește documentul despre transportul din Elveția.', classifyOcrArchiveIntent],
    ['Ce informații avem deja despre Clicktrans?', classifySharedArchiveIntent],
  ])('detects the eligible archive resolver semantically: %s', (text, classifier) => {
    expect(classifier(text)).toMatchObject({ eligible: true });
  });

  it.each([
    'Tradu acest text în germană.',
    'Deschide camera.',
    'Care este vremea în Zürich?',
    'Trimite un Gmail către Clicktrans.',
  ])('keeps unrelated requests out of archive retrieval: %s', (text) => {
    expect(classifyTranslationArchiveIntent(text).eligible).toBe(false);
    expect(classifyOcrArchiveIntent(text).eligible).toBe(false);
    expect(classifySharedArchiveIntent(text).eligible).toBe(false);
  });

  it('authorizes every eligible resolver before retrieval and injects only the minimal package', async () => {
    const query = jest.fn(async () => [{
      id: 'record-1', category: 'TRANSLATION', namespace: 'agm.translation.user-approved', title: 'Traducere Clicktrans',
      payload: { translatedText: 'Clicktrans confirmed the offer.' }, syncPolicy: 'SYNC_ALLOWED', persistence: 'USER_APPROVED_PERSISTENT',
      sourceSurface: 'ANDROID', observedAt: '2026-09-18T10:00:00.000Z', createdAt: '2026-09-18T10:00:00.000Z', updatedAt: '2026-09-18T10:00:00.000Z',
      revokedAt: null, deletedAt: null, provenance: { ownerUserId: owner.userId, namespace: 'agm.translation.user-approved', contractVersion: 'phase2c', approvalEvidence: 'button' },
    }]);
    const archive = { query };
    const service = new PremiumAssistantLibraryService(undefined, undefined, undefined, () => NOW, archive as never);
    const resolved = await service.resolve(owner, request('Folosește traducerea pe care am făcut-o ieri.', 'BROWSER'));
    expect(resolved.status).toBe('CONTEXT_READY');
    const authorization = resolved.trace.findIndex((event) => event.stage === 'AUTHORIZATION_EVALUATED' && event.resolverId === TRANSLATION_ARCHIVE_RESOLVER_ID);
    const retrieval = resolved.trace.findIndex((event) => event.stage === 'RESOLVER_CALLED' && event.resolverId === TRANSLATION_ARCHIVE_RESOLVER_ID);
    expect(authorization).toBeGreaterThanOrEqual(0);
    expect(authorization).toBeLessThan(retrieval);
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ userId: owner.userId }), expect.objectContaining({ category: 'TRANSLATION', requestSurface: 'BROWSER' }));
    const payload = resolved.contexts[0]?.minimalAuthorizedPayload;
    expect(payload).toEqual(expect.objectContaining({ answerText: expect.any(String), records: expect.any(Array), sources: expect.any(Array) }));
    expect(JSON.stringify(payload)).not.toContain('approvalEvidence');
  });

  it('answers from the AGM archive and never calls the generic provider or web', async () => {
    const providerFetch = jest.spyOn(global, 'fetch');
    const archive = { query: jest.fn(async () => [{
      id: 'record-ocr', category: 'OCR', namespace: 'agm.ocr.user-approved', title: 'CMR Elveția',
      payload: { extractedText: 'CMR pentru transportul din Elveția, încărcare Basel.' }, syncPolicy: 'SYNC_ALLOWED', persistence: 'USER_APPROVED_PERSISTENT', sourceSurface: 'ANDROID',
      observedAt: NOW.toISOString(), createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), revokedAt: null, deletedAt: null,
      provenance: { ownerUserId: owner.userId, namespace: 'agm.ocr.user-approved', contractVersion: 'phase2c', approvalEvidence: 'button' },
    }]) };
    const service = new PremiumAssistantService({ get: () => 'unused-key' } as never, undefined, undefined, undefined, undefined, undefined, archive as never);
    const result = await service.respond(owner, request('Ce document am scanat despre CMR?', 'ANDROID'));
    expect(result).toMatchObject({ provider: 'agm', externalEffectPerformed: false });
    expect(result.text).toContain('CMR pentru transportul din Elveția');
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('returns VERIFIED_NO_DATA only after the authorized OCR resolver ran', async () => {
    const archive = { query: jest.fn(async () => []) };
    const service = new PremiumAssistantLibraryService(undefined, undefined, undefined, () => NOW, archive as never);
    const resolved = await service.resolve(owner, request('Ce document am scanat despre Rotterdam?', 'ANDROID'));
    expect(resolved.status).toBe('VERIFIED_NO_DATA');
    expect(resolved.verifiedNoData).toEqual(expect.arrayContaining([expect.objectContaining({ resolverId: OCR_ARCHIVE_RESOLVER_ID, source: 'OCR_ARCHIVE' })]));
    expect(resolved.dispatch.genericFallbackAllowed).toBe(true);
    expect(resolved.trace).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'RESOLVER_CALLED', resolverId: OCR_ARCHIVE_RESOLVER_ID }),
      expect.objectContaining({ stage: 'DISPATCH_DECIDED', outcome: 'VERIFIED_NO_DATA' }),
    ]));
  });

  it('registers persistent history and shared archive under the same authority without Car Mover migration', async () => {
    const archive = { query: jest.fn(async () => []) };
    const service = new PremiumAssistantLibraryService(undefined, undefined, undefined, () => NOW, archive as never);
    const resolved = await service.resolve(owner, request('Ce conversație salvată avem în arhiva despre Clicktrans?', 'BROWSER'));
    const ids = resolved.mandates.flatMap((mandate) => mandate.authorizedResolvers.map((resolver) => resolver.resolverId));
    expect(ids).toEqual(expect.arrayContaining([PERSISTENT_HISTORY_RESOLVER_ID, SHARED_ARCHIVE_RESOLVER_ID]));
    expect(resolved.domains).toEqual(['PREMIUM']);
  });
});

function request(confirmedText: string, surface: 'ANDROID' | 'BROWSER') {
  return { productId: 'agm-cockpit' as const, moduleId: 'premium-cockpit', language: 'ro' as const, confirmedText, surface, history: [] };
}
