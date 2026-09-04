import { UnauthorizedException } from '@nestjs/common';
import { TurnOperationalTruthController } from '../src/turn-operational-truth/turn-operational-truth.controller';

describe('TurnOperationalTruthController functional overview', () => {
  const response = () => ({ setHeader: jest.fn() });

  it('requires Owner Access before reading any functional source', async () => {
    const overview = { snapshot: jest.fn() };
    const admin = { requireOperationalAccess: jest.fn().mockRejectedValue(new UnauthorizedException()) };
    const controller = new TurnOperationalTruthController({} as never, overview as never, admin as never, {} as never);

    await expect(controller.productOverview(undefined, response() as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(overview.snapshot).not.toHaveBeenCalled();
  });

  it('returns a no-store projection after access is verified', async () => {
    const projection = { contractVersion: 'turn-functional-overview.v2' };
    const overview = { snapshot: jest.fn().mockResolvedValue(projection) };
    const admin = { requireOperationalAccess: jest.fn().mockResolvedValue(undefined) };
    const res = response();
    const controller = new TurnOperationalTruthController({} as never, overview as never, admin as never, {} as never);

    await expect(controller.productOverview('Bearer owner', res as never)).resolves.toMatchObject({ data: projection });
    expect(admin.requireOperationalAccess).toHaveBeenCalledWith('Bearer owner');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Authorization');
  });
});
