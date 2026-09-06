import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TurnAdminController } from './turn-admin.controller';
import { TurnAdminService } from './turn-admin.service';
import { CsrfOriginGuard } from '../auth/csrf-origin.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET') }),
    }),
  ],
  controllers: [TurnAdminController],
  providers: [TurnAdminService, CsrfOriginGuard],
  exports: [TurnAdminService],
})
export class TurnAdminModule {}
