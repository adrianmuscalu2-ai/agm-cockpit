import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TurnAdminController } from './turn-admin.controller';
import { TurnAdminService } from './turn-admin.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET', 'change-me-in-development') }),
    }),
  ],
  controllers: [TurnAdminController],
  providers: [TurnAdminService],
})
export class TurnAdminModule {}
