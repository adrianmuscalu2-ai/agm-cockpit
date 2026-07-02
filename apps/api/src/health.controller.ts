import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      data: {
        status: 'ok',
        service: 'agm-api',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
