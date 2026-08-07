import { Module } from '@nestjs/common';
import { ProductionPreflightController } from './production-preflight.controller';
import { ProductionPreflightService } from './production-preflight.service';

@Module({ controllers: [ProductionPreflightController], providers: [ProductionPreflightService] })
export class ProductionPreflightModule {}
