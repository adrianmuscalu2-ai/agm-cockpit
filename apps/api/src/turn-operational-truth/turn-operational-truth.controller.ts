import { Controller, Get, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { responseEnvelope } from '../common/response';
import { TurnOperationalTruthService } from './turn-operational-truth.service';

@Controller('operations/turn')
export class TurnOperationalTruthController {
  constructor(private readonly truth: TurnOperationalTruthService) {}

  @Get('operational-truth')
  @Throttle({ default: { limit: 60, ttl: 60_000, blockDuration: 60_000 } })
  async snapshot(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return responseEnvelope(await this.truth.snapshot());
  }
}
