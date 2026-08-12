import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AUTH_CONTRACT } from '../src/auth/auth.contract';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { UsersService } from '../src/users/users.service';

describe('API-002 Auth & Users contract', () => {
  const prismaMock = () => ({
    user: { update: jest.fn().mockResolvedValue(undefined) },
    authSession: {
      create: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  });
  const activeUser = {
    id: 'user-1',
    companyId: 'company-1',
    displayName: 'Owner',
    email: 'owner@agm.test',
    status: 'Active',
    passwordHash: '',
    roles: [
      { companyId: 'company-1', role: { companyId: 'company-1', code: 'OWNER', isActive: true } },
      { companyId: 'company-1', role: { companyId: 'company-1', code: 'OLD', isActive: false } },
      { companyId: 'company-2', role: { companyId: 'company-2', code: 'FOREIGN', isActive: true } },
    ],
  };

  it('issues a tenant-scoped token and includes only active roles owned by that tenant', async () => {
    const user = { ...activeUser, passwordHash: await bcrypt.hash('correct-password', 4) };
    const users = { findByEmail: jest.fn().mockResolvedValue(user) };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    const prisma = prismaMock();
    const service = new AuthService(users as never, jwt as unknown as JwtService, prisma as never);

    await expect(service.login('owner@agm.test', 'correct-password')).resolves.toMatchObject({
      accessToken: 'token',
      user: { companyId: 'company-1', roles: ['OWNER'] },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      companyId: 'company-1',
      roles: ['OWNER'],
      scope: AUTH_CONTRACT.tokenScope,
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      companyId: 'company-1', userId: 'user-1', tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    }) });
  });

  it.each([
    [null, 'password'],
    [{ ...activeUser, status: 'Disabled', passwordHash: 'unused' }, 'password'],
  ])('returns the same unauthorized boundary for missing or inactive identities', async (user, password) => {
    const service = new AuthService(
      { findByEmail: jest.fn().mockResolvedValue(user) } as never,
      { signAsync: jest.fn() } as unknown as JwtService,
      prismaMock() as never,
    );
    await expect(service.login('owner@agm.test', password)).rejects.toMatchObject({
      message: 'Invalid credentials.',
    });
  });

  it('restores only an active, unexpired, non-revoked refresh session and never persists the raw token', async () => {
    const prisma = prismaMock();
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
      user: activeUser,
    });
    const jwt = { signAsync: jest.fn().mockResolvedValue('restored-access-token') };
    const service = new AuthService({} as never, jwt as unknown as JwtService, prisma as never);
    const restored = await service.refresh('raw-refresh-token');
    expect(restored.accessToken).toBe('restored-access-token');
    expect(prisma.authSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    }));
    expect(JSON.stringify(prisma.authSession.findUnique.mock.calls)).not.toContain('raw-refresh-token');
    expect(prisma.authSession.update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { lastUsedAt: expect.any(Date) } });
  });

  it.each([
    [undefined, undefined],
    ['missing', null],
    ['revoked', { id:'session-r', revokedAt:new Date(), expiresAt:new Date(Date.now()+60_000), user:activeUser }],
    ['expired', { id:'session-e', revokedAt:null, expiresAt:new Date(Date.now()-1), user:activeUser }],
    ['inactive-user', { id:'session-i', revokedAt:null, expiresAt:new Date(Date.now()+60_000), user:{ ...activeUser, status:'Disabled' } }],
  ])('rejects invalid refresh sessions: %s', async (_label, session) => {
    const prisma = prismaMock();
    prisma.authSession.findUnique.mockResolvedValue(session);
    const service = new AuthService({} as never, { signAsync: jest.fn() } as unknown as JwtService, prisma as never);
    await expect(service.refresh(_label === undefined ? undefined : 'token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes a refresh session idempotently on logout', async () => {
    const prisma = prismaMock();
    const service = new AuthService({} as never, { signAsync: jest.fn() } as unknown as JwtService, prisma as never);
    await service.logout('raw-refresh-token');
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    await service.logout(undefined);
    expect(prisma.authSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it('keeps the refresh token out of the response and applies the secure HttpOnly cookie contract', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const auth = {
        login: jest.fn().mockResolvedValue({
          accessToken: 'access-token', rawRefreshToken: 'raw-refresh-secret',
          user: { id:'user-1', companyId:'company-1', displayName:'Owner', email:'owner@agm.test', roles:['OWNER'] },
        }),
      };
      const response = { cookie: jest.fn() };
      const controller = new AuthController(auth as never);
      const envelope = await controller.login({ email:'owner@agm.test', password:'not-recorded' }, response as never);
      expect(JSON.stringify(envelope)).not.toContain('raw-refresh-secret');
      expect(response.cookie).toHaveBeenCalledWith('agm_refresh', 'raw-refresh-secret', {
        httpOnly:true, sameSite:'lax', secure:true,
        maxAge:AUTH_CONTRACT.refreshSessionDays * 86400_000, path:'/api/v1/auth',
      });
    } finally { process.env.NODE_ENV = previousEnvironment; }
  });

  it('revokes and clears logout cookie on the same restricted path', async () => {
    const auth = { logout: jest.fn().mockResolvedValue(undefined) };
    const response = { clearCookie: jest.fn() };
    const controller = new AuthController(auth as never);
    await expect(controller.logout({ headers:{ cookie:'agm_refresh=opaque-value; other=value' } } as never, response as never))
      .resolves.toEqual(expect.objectContaining({ data:{ loggedOut:true } }));
    expect(auth.logout).toHaveBeenCalledWith('opaque-value');
    expect(response.clearCookie).toHaveBeenCalledWith('agm_refresh', { path:'/api/v1/auth' });
  });

  it('rejects an ambiguous email instead of selecting a tenant arbitrarily', async () => {
    const prisma = { user: { findMany: jest.fn().mockResolvedValue([activeUser, { ...activeUser, companyId: 'company-2' }]) } };
    const users = new UsersService(prisma as never);
    await expect(users.findByEmail(' Owner@AGM.test ')).resolves.toBeNull();
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: 'Owner@AGM.test', mode: 'insensitive' } },
      take: 2,
    }));
  });

  it('revalidates tenant, user status, scope, and roles from persistence', async () => {
    const strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'test-secret-with-at-least-32-characters' }),
      { findById: jest.fn().mockResolvedValue(activeUser) } as never,
    );
    await expect(strategy.validate({
      sub: 'user-1', companyId: 'company-1', roles: ['FOREIGN'], scope: 'user',
    })).resolves.toMatchObject({ companyId: 'company-1', roles: ['OWNER'] });
    await expect(strategy.validate({
      sub: 'user-1', companyId: 'company-2', roles: ['OWNER'], scope: 'user',
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
