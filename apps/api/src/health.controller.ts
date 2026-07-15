import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';

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
        service: 'agm-api',
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
        service: 'agm-api',
        dependencies,
      });
    }

    if (dependencies.translationProvider !== 'configured') {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: 'agm-api',
        dependencies,
      });
    }

    return {
      data: {
        status: 'ready',
        service: 'agm-api',
        dependencies,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
