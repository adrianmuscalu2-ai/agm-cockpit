import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { AUTH_CONTRACT } from '../src/auth/auth.contract';

describe('human JWT boundary rejects machine subjects before UUID lookup', () => {
  it.each([undefined, 'acp:read', 'acp:read governance:propose', 'turn-admin'])('rejects non-user scope %s without querying a UUID user id', async scope => {
    const users = { findById: jest.fn().mockRejectedValue(new Error('DATABASE_UUID_TYPE_ERROR')) };
    const strategy = new JwtStrategy(new ConfigService({ JWT_SECRET: 's'.repeat(48) }), users as never);
    await expect(strategy.validate({ sub: 'atlas-operations', companyId: '00000000-0000-0000-0000-000000000001', roles: [], scope })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('keeps normal existing human credential-version validation unchanged', async () => {
    const id = '00000000-0000-4000-8000-000000000011';
    const companyId = '00000000-0000-0000-0000-000000000001';
    const users = { findById: jest.fn().mockResolvedValue({ id, companyId, status: 'Active', credentialVersion: 1, roles: [] }) };
    const strategy = new JwtStrategy(new ConfigService({ JWT_SECRET: 's'.repeat(48) }), users as never);
    await expect(strategy.validate({ sub: id, companyId, roles: [], scope: AUTH_CONTRACT.tokenScope, credentialVersion: 1 })).resolves.toMatchObject({ userId: id, companyId });
    await expect(strategy.validate({ sub: id, companyId, roles: [], scope: AUTH_CONTRACT.tokenScope, credentialVersion: 0 })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
