import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { responseEnvelope } from '../common/response';
import { SecretTelemetryService } from './secret-telemetry.service';

@Controller('security/secrets')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 12, ttl: 60_000, blockDuration: 60_000 } })
export class SecretTelemetryController {
  constructor(private readonly telemetry: SecretTelemetryService) {}

  @Get('health')
  health() {
    return responseEnvelope(this.telemetry.snapshot());
  }
}
