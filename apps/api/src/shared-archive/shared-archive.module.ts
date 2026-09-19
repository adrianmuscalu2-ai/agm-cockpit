import { Module } from '@nestjs/common';
import { SharedArchiveController } from './shared-archive.controller';
import { SharedArchiveService } from './shared-archive.service';

@Module({ controllers: [SharedArchiveController], providers: [SharedArchiveService], exports: [SharedArchiveService] })
export class SharedArchiveModule {}
