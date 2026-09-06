import { TURN_ADMIN_CONTRACT } from '../src/turn-admin/turn-admin.contract';
import { TurnAdminController } from '../src/turn-admin/turn-admin.controller';

describe('API-007 TurnAdminController refresh-cookie contract', () => {
  const issued = {
    accessToken: 'short-access-token',
    expiresInSeconds: TURN_ADMIN_CONTRACT.sessionSeconds,
    rawRefreshToken: 'opaque-refresh-secret',
  };

  it('keeps the refresh token out of the response and sets a host-only Secure HttpOnly cookie', async () => {
    const service = { unlock: jest.fn().mockResolvedValue(issued) };
    const response = { cookie: jest.fn() };
    const controller = new TurnAdminController(service as never);

    const envelope = await controller.unlock({ pin: 'not-recorded' }, response as never);

    expect(JSON.stringify(envelope)).not.toContain(issued.rawRefreshToken);
    expect(response.cookie).toHaveBeenCalledWith('agm_turn_refresh', issued.rawRefreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: TURN_ADMIN_CONTRACT.refreshSessionDays * 86_400_000,
      path: '/api/v1/turn-admin',
    });
    expect(response.cookie.mock.calls[0][2]).not.toHaveProperty('domain');
  });

  it('rotates from the HttpOnly cookie and replaces it with the new opaque token', async () => {
    const rotated = { ...issued, accessToken: 'new-access-token', rawRefreshToken: 'new-refresh-secret' };
    const service = { refresh: jest.fn().mockResolvedValue(rotated) };
    const response = { cookie: jest.fn() };
    const controller = new TurnAdminController(service as never);

    const envelope = await controller.refresh({ headers: { cookie: `other=x; agm_turn_refresh=${issued.rawRefreshToken}` } } as never, response as never);

    expect(service.refresh).toHaveBeenCalledWith(issued.rawRefreshToken);
    expect(response.cookie).toHaveBeenCalledWith('agm_turn_refresh', rotated.rawRefreshToken, expect.objectContaining({ path: '/api/v1/turn-admin' }));
    expect(JSON.stringify(envelope)).not.toContain(rotated.rawRefreshToken);
  });

  it('keeps PIN throttling separate from the higher-capacity silent-refresh route', () => {
    const metadata = Reflect.getMetadata('THROTTLER:LIMITdefault', TurnAdminController.prototype.refresh);
    expect(metadata).toBe(30);
  });

  it('revokes logout and clears the cookie on the same security scope', async () => {
    const service = { logout: jest.fn().mockResolvedValue(undefined) };
    const response = { clearCookie: jest.fn() };
    const controller = new TurnAdminController(service as never);

    await controller.logout({ headers: { cookie: `agm_turn_refresh=${issued.rawRefreshToken}` } } as never, response as never);

    expect(service.logout).toHaveBeenCalledWith(issued.rawRefreshToken);
    expect(response.clearCookie).toHaveBeenCalledWith('agm_turn_refresh', expect.objectContaining({
      httpOnly: true, sameSite: 'none', secure: true, path: '/api/v1/turn-admin',
    }));
  });
});
