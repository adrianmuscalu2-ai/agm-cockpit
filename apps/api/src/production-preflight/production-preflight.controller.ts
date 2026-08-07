import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { responseEnvelope } from '../common/response';
import { ProductionPreflightService } from './production-preflight.service';

@Controller('operations/production-preflight')
@SkipThrottle()
export class ProductionPreflightController {
  constructor(private readonly service: ProductionPreflightService) {}
  @Get() snapshot() { return responseEnvelope(this.service.snapshot()); }
}
