import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { ComponentTelemetryService } from './component-telemetry.service';
import { RecordComponentHeartbeatDto } from './dto/record-component-heartbeat.dto';

@Controller('operations/components')
@UseGuards(JwtAuthGuard)
export class ComponentTelemetryController {
  constructor(private readonly telemetry: ComponentTelemetryService) {}

  @Post(':componentId/heartbeat')
  @Throttle({ default: { limit: 6, ttl: 60_000, blockDuration: 60_000 } })
  async heartbeat(@Param('componentId') componentId: string, @Body() body: RecordComponentHeartbeatDto, @CurrentUser() user: RequestContext) {
    return responseEnvelope(await this.telemetry.heartbeat(componentId.trim().toLowerCase(), body, user));
  }

  @Get(':componentId/health')
  @Throttle({ default: { limit: 30, ttl: 60_000, blockDuration: 60_000 } })
  async health(@Param('componentId') componentId: string, @CurrentUser() user: RequestContext) {
    return responseEnvelope(await this.telemetry.health(componentId.trim().toLowerCase(), user));
  }
}
