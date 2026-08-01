import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { API_CORE_CONTRACT } from './api-core.contract';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  @Get()
  getHealth() {
    return this.live();
  }

  @Get('live')
  live() {
    return {
      data: {
        status: 'ok',
        service: API_CORE_CONTRACT.service,
        check: 'live',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('ready')
  async ready() {
    const dependencies = {
      database: 'unavailable',
      translationProvider: this.config.get<string>('OPENAI_API_KEY') ? 'configured' : 'unavailable',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dependencies.database = 'available';
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: API_CORE_CONTRACT.service,
        dependencies,
      });
    }

    if (dependencies.translationProvider !== 'configured') {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: API_CORE_CONTRACT.service,
        dependencies,
      });
    }

    return {
      data: {
        status: 'ready',
        service: API_CORE_CONTRACT.service,
        dependencies,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
