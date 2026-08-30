import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SourceFreshnessScanService } from './source-freshness.scan.service';

@Injectable()
export class SourceFreshnessScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  constructor(private readonly scans: SourceFreshnessScanService, private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('AGM_SOURCE_FRESHNESS_SCHEDULER_ENABLED') !== 'true') return;
    const configured = Number(this.config.get<string>('AGM_SOURCE_FRESHNESS_SCAN_INTERVAL_MS'));
    const interval = Number.isInteger(configured) && configured >= 60_000 ? configured : 86_400_000;
    void this.scans.scan().catch(() => undefined);
    this.timer = setInterval(() => void this.scans.scan().catch(() => undefined), interval);
    this.timer.unref();
  }

  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }
}
