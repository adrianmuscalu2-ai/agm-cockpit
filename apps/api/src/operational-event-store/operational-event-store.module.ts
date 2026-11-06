import { Module } from '@nestjs/common';
import { TurnAdminModule } from '../turn-admin/turn-admin.module';
import { OperationalEventStoreController } from './operational-event-store.controller';
import { OperationalEventStoreService } from './operational-event-store.service';
import { OperationalEventSemanticSearchService } from './operational-event-semantic-search.service';
@Module({ imports: [TurnAdminModule], controllers: [OperationalEventStoreController], providers: [OperationalEventStoreService, OperationalEventSemanticSearchService], exports: [OperationalEventStoreService] })
export class OperationalEventStoreModule {}
