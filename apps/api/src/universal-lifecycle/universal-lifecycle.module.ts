import { Module } from '@nestjs/common';
import { UniversalLifecycleService } from './universal-lifecycle.service';

@Module({ providers: [UniversalLifecycleService], exports: [UniversalLifecycleService] })
export class UniversalLifecycleModule {}
