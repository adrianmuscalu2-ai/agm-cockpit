import { ConflictException, HttpException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { TURN_ADMIN_CONTRACT } from '../src/turn-admin/turn-admin.contract';
import { TurnAdminService } from '../src/turn-admin/turn-admin.service';

type StoredSession = {
  id: string;
  familyId: string;
  generation: number;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedAt: Date | null;
  reuseDetectedAt: Date | null;
  lastUsedAt: Date;
  createdAt: Date;
};

describe('API-007 TurnAdminService session continuity', () => {
  const correctPin = '2468';
  let credential: { id: string; passwordHash: string; failedAttempts: number; lockedUntil: Date | null };
  let sessions: StoredSession[];
  let service: TurnAdminService;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let prisma: ReturnType<typeof prismaMock>;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    credential = {
      id: 'turn-command-center',
      passwordHash: await bcrypt.hash(correctPin, 4),
      failedAttempts: 0,
      lockedUntil: null,
    };
    sessions = [];
    prisma = prismaMock();
    jwt = {
      signAsync: jest.fn(async (payload) => `access-${payload.sid}-${payload.generation}`),
      verifyAsync: jest.fn(),
    };
    service = new TurnAdminService(
      prisma as never,
      new ConfigService({ JWT_SECRET: 'test-secret-with-at-least-32-characters' }),
      jwt as unknown as JwtService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('issues a short access token plus a hashed, revocable refresh family and never logs raw credentials', async () => {
    credential.failedAttempts = 3;
    const result = await service.unlock(correctPin);

    expect(result).toEqual({
      accessToken: expect.stringMatching(/^access-/),
      expiresInSeconds: 900,
      rawRefreshToken: expect.any(String),
    });
    expect(result.rawRefreshToken).toHaveLength(64);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ generation: 0, revokedAt: null });
    expect(sessions[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sessions[0].tokenHash).not.toBe(result.rawRefreshToken);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      scope: 'turn-admin', sid: sessions[0].id, familyId: sessions[0].familyId, generation: 0,
    }, { expiresIn: '900s' });
    expect(credential.failedAttempts).toBe(0);
    expect(Logger.prototype.log).not.toHaveBeenCalledWith(expect.stringContaining(result.rawRefreshToken));
  });

  it('allows accelerated expiry only in the test environment and keeps the production TTL fixed', async () => {
    const testService = new TurnAdminService(
      prisma as never,
      new ConfigService({
        NODE_ENV: 'test',
        JWT_SECRET: 'test-secret-with-at-least-32-characters',
        AGM_TURN_ADMIN_TEST_ACCESS_TTL_SECONDS: '2',
      }),
      jwt as unknown as JwtService,
    );
    const accelerated = await testService.unlock(correctPin);
    expect(accelerated.expiresInSeconds).toBe(2);
    expect(jwt.signAsync).toHaveBeenLastCalledWith(expect.any(Object), { expiresIn: '2s' });

    const productionService = new TurnAdminService(
      prisma as never,
      new ConfigService({
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret-with-at-least-32-characters',
        AGM_TURN_ADMIN_TEST_ACCESS_TTL_SECONDS: '2',
      }),
      jwt as unknown as JwtService,
    );
    const production = await productionService.unlock(correctPin);
    expect(production.expiresInSeconds).toBe(TURN_ADMIN_CONTRACT.sessionSeconds);
  });

  it('rotates the refresh token atomically, invalidates the prior access session, and accepts the new access session', async () => {
    const initial = await service.unlock(correctPin);
    const old = sessions[0];
    const rotated = await service.refresh(initial.rawRefreshToken);
    const next = sessions.find((item) => item.generation === 1)!;

    expect(rotated.rawRefreshToken).not.toBe(initial.rawRefreshToken);
    expect(old.revokedAt).toBeInstanceOf(Date);
    expect(old.replacedAt).toBeInstanceOf(Date);
    expect(next).toMatchObject({ familyId: old.familyId, generation: 1, revokedAt: null });

    jwt.verifyAsync.mockResolvedValue(accessPayload(old));
    await expect(service.requireOperationalAccess(`Bearer ${initial.accessToken}`)).rejects.toBeInstanceOf(UnauthorizedException);
    jwt.verifyAsync.mockResolvedValue(accessPayload(next));
    await expect(service.requireOperationalAccess(`Bearer ${rotated.accessToken}`)).resolves.toBeUndefined();
  });

  it('treats a concurrent duplicate refresh as a recoverable conflict without revoking the new token', async () => {
    const initial = await service.unlock(correctPin);
    const rotated = await service.refresh(initial.rawRefreshToken);
    const next = sessions.find((item) => item.generation === 1)!;

    await expect(service.refresh(initial.rawRefreshToken)).rejects.toBeInstanceOf(ConflictException);
    expect(next.revokedAt).toBeNull();
    expect(next.reuseDetectedAt).toBeNull();
    jwt.verifyAsync.mockResolvedValue(accessPayload(next));
    await expect(service.requireOperationalAccess(`Bearer ${rotated.accessToken}`)).resolves.toBeUndefined();
  });

  it('accepts only bounded negative clock skew in the concurrency window', async () => {
    const initial = await service.unlock(correctPin);
    await service.refresh(initial.rawRefreshToken);
    const old = sessions.find((item) => item.generation === 0)!;
    const next = sessions.find((item) => item.generation === 1)!;
    old.replacedAt = new Date(Date.now() + (TURN_ADMIN_CONTRACT.clockSkewToleranceSeconds - 1) * 1_000);

    await expect(service.refresh(initial.rawRefreshToken)).rejects.toBeInstanceOf(ConflictException);
    expect(next.revokedAt).toBeNull();

    old.replacedAt = new Date(Date.now() + (TURN_ADMIN_CONTRACT.clockSkewToleranceSeconds + 1) * 1_000);
    await expect(service.refresh(initial.rawRefreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(next.revokedAt).toBeInstanceOf(Date);
  });

  it('detects real reuse outside the concurrency window and revokes the active family', async () => {
    const initial = await service.unlock(correctPin);
    await service.refresh(initial.rawRefreshToken);
    const old = sessions.find((item) => item.generation === 0)!;
    const next = sessions.find((item) => item.generation === 1)!;
    old.replacedAt = new Date(Date.now() - (TURN_ADMIN_CONTRACT.refreshConcurrencyGraceSeconds + 1) * 1_000);

    await expect(service.refresh(initial.rawRefreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(next.revokedAt).toBeInstanceOf(Date);
    expect(next.reuseDetectedAt).toBeInstanceOf(Date);
  });

  it('revokes the complete refresh family on explicit logout', async () => {
    const initial = await service.unlock(correctPin);
    const rotated = await service.refresh(initial.rawRefreshToken);
    const next = sessions.find((item) => item.generation === 1)!;

    await service.logout(rotated.rawRefreshToken);
    expect(next.revokedAt).toBeInstanceOf(Date);
    jwt.verifyAsync.mockResolvedValue(accessPayload(next));
    await expect(service.requireOperationalAccess(`Bearer ${rotated.accessToken}`)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(rotated.rawRefreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('"reason":"revoked"'));
  });

  it('revokes every active administrative session when credentials change', async () => {
    await service.unlock(correctPin);
    const active = sessions[0];
    jwt.verifyAsync.mockResolvedValue(accessPayload(active));

    await expect(service.changePin('Bearer active', correctPin, '8642')).resolves.toEqual({ changed: true });
    expect(await bcrypt.compare('8642', credential.passwordHash)).toBe(true);
    expect(sessions.every((session) => session.revokedAt instanceof Date)).toBe(true);
  });

  it('rejects an expired refresh family', async () => {
    const initial = await service.unlock(correctPin);
    sessions[0].expiresAt = new Date(Date.now() - 1);
    await expect(service.refresh(initial.rawRefreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('locks on the fifth invalid PIN without logging the PIN', async () => {
    credential.failedAttempts = 4;
    await expect(service.unlock('0000')).rejects.toBeInstanceOf(HttpException);
    expect(credential.failedAttempts).toBe(5);
    expect(credential.lockedUntil).toBeInstanceOf(Date);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('"outcome":"locked"'));
    expect(Logger.prototype.warn).not.toHaveBeenCalledWith(expect.stringContaining('0000'));
  });

  it('rejects an unbound or wrong-scope access JWT', async () => {
    jwt.verifyAsync.mockResolvedValue({ scope: 'user' });
    await expect(service.validate('Bearer user-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('"reason":"invalid-session"'));
  });

  function prismaMock() {
    const turnAdminSession = {
      create: jest.fn(async ({ data }: { data: Partial<StoredSession> }) => {
        const session: StoredSession = {
          id: data.id ?? `session-${sessions.length + 1}`,
          familyId: data.familyId!,
          generation: data.generation ?? 0,
          tokenHash: data.tokenHash!,
          expiresAt: data.expiresAt!,
          revokedAt: null,
          replacedAt: null,
          reuseDetectedAt: null,
          lastUsedAt: new Date(),
          createdAt: new Date(),
        };
        sessions.push(session);
        return session;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id?: string; tokenHash?: string } }) =>
        sessions.find((item) => where.id ? item.id === where.id : item.tokenHash === where.tokenHash) ?? null),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, any>; data: Partial<StoredSession> }) => {
        const matching = sessions.filter((item) => matches(item, where));
        matching.forEach((item) => Object.assign(item, data));
        return { count: matching.length };
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    };
    const value: any = {
      turnAdminCredential: {
        findUnique: jest.fn(async () => ({ ...credential })),
        update: jest.fn(async ({ data }: { data: Partial<typeof credential> }) => Object.assign(credential, data)),
        create: jest.fn(),
      },
      turnAdminSession,
      $transaction: jest.fn(async (operation: (transaction: unknown) => unknown) => operation(value)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    };
    return value;
  }
});

function accessPayload(session: StoredSession) {
  return { scope: TURN_ADMIN_CONTRACT.tokenScope, sid: session.id, familyId: session.familyId, generation: session.generation };
}

function matches(session: StoredSession, where: Record<string, any>) {
  if (where.id !== undefined && session.id !== where.id) return false;
  if (where.tokenHash !== undefined && session.tokenHash !== where.tokenHash) return false;
  if (where.familyId !== undefined && session.familyId !== where.familyId) return false;
  if (where.revokedAt === null && session.revokedAt !== null) return false;
  if (where.expiresAt?.gt && session.expiresAt <= where.expiresAt.gt) return false;
  return true;
}
