import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HealthController', () => {
  const configuration = new ConfigService({ OPENAI_API_KEY: 'configured' });

  it('reports liveness without touching dependencies', () => {
    const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
    const controller = new HealthController(prisma, configuration);
    expect(controller.live().data).toMatchObject({ status: 'ok', check: 'live' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness after a real database probe', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
    const controller = new HealthController(prisma, configuration);
    await expect(controller.ready()).resolves.toMatchObject({
      data: { status: 'ready', dependencies: { database: 'available', translationProvider: 'configured' } },
    });
  });

  it('reports not ready when the database probe fails', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('private connection detail')) } as unknown as PrismaService;
    const controller = new HealthController(prisma, configuration);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports not ready when the translation provider is not configured', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
    const unavailableProvider = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const controller = new HealthController(prisma, unavailableProvider);
    await expect(controller.ready()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        service: 'agm-api',
        dependencies: { database: 'available', translationProvider: 'unavailable' },
      },
    });
  });
});
