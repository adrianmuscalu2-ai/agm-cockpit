import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { responseEnvelope } from '../common/response';
import { SourceFreshnessScanService } from './source-freshness.scan.service';

@Controller('source-freshness')
@UseGuards(JwtAuthGuard)
export class SourceFreshnessController {
  constructor(private readonly scans: SourceFreshnessScanService) {}
  @Post('scan') async scan() { return responseEnvelope(await this.scans.scan()); }
  @Get('states') async states() { return responseEnvelope(await this.scans.states()); }
  @Get('review-queue') async reviews() { return responseEnvelope(await this.scans.reviews()); }
}
