import { Module } from '@nestjs/common';
import { TurnAdminModule } from '../turn-admin/turn-admin.module';
import { OperationalEventStoreController } from './operational-event-store.controller';
import { OperationalEventStoreService } from './operational-event-store.service';
@Module({ imports: [TurnAdminModule], controllers: [OperationalEventStoreController], providers: [OperationalEventStoreService], exports: [OperationalEventStoreService] })
export class OperationalEventStoreModule {}
