import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { responseEnvelope } from '../common/response';
import { SecretTelemetryService } from './secret-telemetry.service';

@Controller('security/secrets')
@SkipThrottle()
export class SecretTelemetryController {
  constructor(private readonly telemetry: SecretTelemetryService) {}

  @Get('health')
  health() {
    return responseEnvelope(this.telemetry.snapshot());
  }
}
