import { Module } from '@nestjs/common';
import { PreDepartureSyncController } from './pre-departure-sync.controller';
import { PreDepartureSyncService } from './pre-departure-sync.service';

@Module({
  controllers: [PreDepartureSyncController],
  providers: [PreDepartureSyncService],
})
export class PreDepartureSyncModule {}
