import { HttpException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { TURN_ADMIN_CONTRACT } from '../src/turn-admin/turn-admin.contract';
import { TurnAdminService } from '../src/turn-admin/turn-admin.service';

describe('API-007 TurnAdminService', () => {
  const correctPin = '2468';
  let credential: { id: string; passwordHash: string; failedAttempts: number; lockedUntil: Date | null };
  let service: TurnAdminService;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    credential = {
      id: 'turn-command-center',
      passwordHash: await bcrypt.hash(correctPin, 4),
      failedAttempts: 0,
      lockedUntil: null,
    };
    const prisma = {
      turnAdminCredential: {
        findUnique: jest.fn(async () => ({ ...credential })),
        update: jest.fn(async ({ data }: { data: Partial<typeof credential> }) => {
          credential = { ...credential, ...data };
          return { ...credential };
        }),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (operation: (transaction: unknown) => unknown) => operation({
        $executeRawUnsafe: jest.fn().mockResolvedValue(0),
        turnAdminCredential: {
          update: jest.fn(async ({ data }: { data: Partial<typeof credential> }) => {
            credential = { ...credential, ...data };
            return { ...credential };
          }),
        },
      })),
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('safe-test-token'),
      verifyAsync: jest.fn().mockResolvedValue({ scope: TURN_ADMIN_CONTRACT.tokenScope }),
    };
    const config = new ConfigService({ JWT_SECRET: 'test-secret-with-at-least-32-characters' });
    service = new TurnAdminService(prisma as never, config, jwt as unknown as JwtService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('issues only the scoped 15-minute administrative session and resets failures', async () => {
    credential.failedAttempts = 3;
    const session = await service.unlock(correctPin);
    expect(session).toEqual({ accessToken: 'safe-test-token', expiresInSeconds: 900 });
    expect(jwt.signAsync).toHaveBeenCalledWith({ scope: 'turn-admin' }, { expiresIn: '900s' });
    expect(credential.failedAttempts).toBe(0);
    expect(credential.lockedUntil).toBeNull();
  });

  it('locks on the fifth invalid PIN without logging the PIN', async () => {
    credential.failedAttempts = 4;
    await expect(service.unlock('0000')).rejects.toBeInstanceOf(HttpException);
    expect(credential.failedAttempts).toBe(5);
    expect(credential.lockedUntil).toBeInstanceOf(Date);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('"outcome":"locked"'));
    expect(Logger.prototype.warn).not.toHaveBeenCalledWith(expect.stringContaining('0000'));
  });

  it('rejects an invalid token scope and emits a safe audit event', async () => {
    jwt.verifyAsync.mockResolvedValue({ scope: 'user' });
    await expect(service.validate('Bearer user-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('"reason":"invalid-session"'));
    expect(Logger.prototype.warn).not.toHaveBeenCalledWith(expect.stringContaining('user-token'));
  });

  it('changes the PIN only after session and current-PIN validation', async () => {
    await expect(service.changePin('Bearer admin-token', correctPin, '8642')).resolves.toEqual({ changed: true });
    expect(await bcrypt.compare('8642', credential.passwordHash)).toBe(true);
    expect(credential.failedAttempts).toBe(0);
  });

  it('attributes an invalid session to the attempted change-pin action', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('expired'));
    await expect(service.changePin('Bearer expired-token', correctPin, '8642')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('"action":"change-pin"'));
  });
});
