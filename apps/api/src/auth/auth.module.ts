import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AUTH_CONTRACT } from './auth.contract';
import { CsrfOriginGuard } from './csrf-origin.guard';
import { RoleProvisioningController } from './role-provisioning.controller';
import { RoleProvisioningService } from './role-provisioning.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', AUTH_CONTRACT.defaultExpiresIn) as NonNullable<NonNullable<JwtModuleOptions['signOptions']>['expiresIn']>,
        },
      }),
    }),
  ],
  controllers: [AuthController, RoleProvisioningController],
  providers: [AuthService, JwtStrategy, CsrfOriginGuard, RoleProvisioningService],
  exports: [AuthService],
})
export class AuthModule {}
