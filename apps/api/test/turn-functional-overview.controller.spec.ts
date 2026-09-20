import { UnauthorizedException } from '@nestjs/common';
import { TurnOperationalTruthController } from '../src/turn-operational-truth/turn-operational-truth.controller';

describe('TurnOperationalTruthController functional overview', () => {
  const response = () => ({ setHeader: jest.fn() });

  it('requires Owner Access before reading any functional source', async () => {
    const overview = { snapshot: jest.fn() };
    const admin = { requireOperationalAccess: jest.fn().mockRejectedValue(new UnauthorizedException()) };
    const controller = new TurnOperationalTruthController({} as never, overview as never, admin as never, {} as never, {} as never);

    await expect(controller.productOverview(undefined, response() as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(overview.snapshot).not.toHaveBeenCalled();
  });

  it('returns a no-store projection after access is verified', async () => {
    const projection = { contractVersion: 'turn-functional-overview.v2' };
    const overview = { snapshot: jest.fn().mockResolvedValue(projection) };
    const admin = { requireOperationalAccess: jest.fn().mockResolvedValue(undefined) };
    const res = response();
    const controller = new TurnOperationalTruthController({} as never, overview as never, admin as never, {} as never, {} as never);

    await expect(controller.productOverview('Bearer owner', res as never)).resolves.toMatchObject({ data: projection });
    expect(admin.requireOperationalAccess).toHaveBeenCalledWith('Bearer owner');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Authorization');
  });

  it('journals only canonical linguistic heartbeats after Owner Access is verified', async () => {
    const admin = { requireOperationalAccess: jest.fn().mockResolvedValue(undefined) };
    const telemetry = { heartbeat: jest.fn().mockResolvedValue({ status: 'ONLINE' }) };
    const controller = new TurnOperationalTruthController({} as never, {} as never, admin as never, {} as never, telemetry as never);

    await expect(controller.recordLinguisticHeartbeat('Bearer owner', 'premium-linguist-it', {
      status: 'ONLINE',
      reason: 'I18N_RESOURCES_VALIDATED',
      detail: 'language=it;total=1713;errors=0',
    })).resolves.toMatchObject({ data: { status: 'ONLINE' } });

    expect(admin.requireOperationalAccess).toHaveBeenCalledWith('Bearer owner');
    expect(telemetry.heartbeat).toHaveBeenCalledWith('premium-linguist-it', expect.objectContaining({ status: 'ONLINE' }), expect.objectContaining({
      companyId: '00000000-0000-0000-0000-000000000001',
      roles: ['PRODUCT_OWNER'],
    }));

    await expect(controller.recordLinguisticHeartbeat('Bearer owner', 'android', {
      status: 'ONLINE',
    })).rejects.toThrow('TURN_LINGUISTIC_HEARTBEAT_ONLY');
    expect(telemetry.heartbeat).toHaveBeenCalledTimes(1);
  });

  it('does not journal a linguistic heartbeat before Owner Access is verified', async () => {
    const admin = { requireOperationalAccess: jest.fn().mockRejectedValue(new UnauthorizedException()) };
    const telemetry = { heartbeat: jest.fn() };
    const controller = new TurnOperationalTruthController({} as never, {} as never, admin as never, {} as never, telemetry as never);

    await expect(controller.recordLinguisticHeartbeat(undefined, 'premium-linguist-it', { status: 'ONLINE' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(telemetry.heartbeat).not.toHaveBeenCalled();
  });
});
