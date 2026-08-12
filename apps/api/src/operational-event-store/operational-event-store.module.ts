import { Module } from '@nestjs/common';
import { OperationalEventStoreController } from './operational-event-store.controller';
import { OperationalEventStoreService } from './operational-event-store.service';
@Module({ controllers: [OperationalEventStoreController], providers: [OperationalEventStoreService], exports: [OperationalEventStoreService] })
export class OperationalEventStoreModule {}
