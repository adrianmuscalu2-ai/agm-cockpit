import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { responseEnvelope } from '../common/response';
import { ProductionPreflightService } from './production-preflight.service';

@Controller('operations/production-preflight')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 12, ttl: 60_000, blockDuration: 60_000 } })
export class ProductionPreflightController {
  constructor(private readonly service: ProductionPreflightService) {}
  @Get() snapshot() { return responseEnvelope(this.service.snapshot()); }
}
