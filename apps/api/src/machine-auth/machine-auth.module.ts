import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { AuthorityControlPlaneModule } from '../authority-control-plane/authority-control-plane.module';
import { DeploymentMachineProvisioningController, MachineProvisioningController, MachineTokenController } from './machine-auth.controller';
import { GitHubActionsOidcGuard } from './github-actions-oidc.guard';
import { GitHubActionsOidcService } from './github-actions-oidc.service';
import { MachineAuthorityController } from './machine-authority.controller';
import { MACHINE_AUTH_CONTRACT } from './machine-auth.contract';
import { MachineAuthService } from './machine-auth.service';
import { MachineJwtAuthGuard } from './machine-jwt-auth.guard';
import { MachineJwtStrategy } from './machine-jwt.strategy';

@Module({
  imports: [
    AuthModule,
    AuthorityControlPlaneModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: MACHINE_AUTH_CONTRACT.accessTokenExpiresInSeconds as NonNullable<NonNullable<JwtModuleOptions['signOptions']>['expiresIn']> },
      }),
    }),
  ],
  controllers: [MachineProvisioningController, DeploymentMachineProvisioningController, MachineTokenController, MachineAuthorityController],
  providers: [MachineAuthService, MachineJwtStrategy, MachineJwtAuthGuard, GitHubActionsOidcService, GitHubActionsOidcGuard],
  exports: [MachineAuthService],
})
export class MachineAuthModule {}
