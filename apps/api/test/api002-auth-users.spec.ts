import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AUTH_CONTRACT } from '../src/auth/auth.contract';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { UsersService } from '../src/users/users.service';

describe('API-002 Auth & Users contract', () => {
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
    const service = new AuthService(users as never, jwt as unknown as JwtService);

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
  });

  it.each([
    [null, 'password'],
    [{ ...activeUser, status: 'Disabled', passwordHash: 'unused' }, 'password'],
  ])('returns the same unauthorized boundary for missing or inactive identities', async (user, password) => {
    const service = new AuthService(
      { findByEmail: jest.fn().mockResolvedValue(user) } as never,
      { signAsync: jest.fn() } as unknown as JwtService,
    );
    await expect(service.login('owner@agm.test', password)).rejects.toMatchObject({
      message: 'Invalid credentials.',
    });
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
