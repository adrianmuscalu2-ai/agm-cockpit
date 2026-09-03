import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { MACHINE_AUTH_CONTRACT, type MachineJwtPayload } from './machine-auth.contract';
import { MachineAuthService } from './machine-auth.service';

@Injectable()
export class MachineJwtStrategy extends PassportStrategy(Strategy, 'machine-jwt') {
  constructor(config: ConfigService, private readonly machines: MachineAuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: MACHINE_AUTH_CONTRACT.issuer,
      audience: MACHINE_AUTH_CONTRACT.audience,
    });
  }

  validate(payload: MachineJwtPayload) {
    return this.machines.validateAccess(payload);
  }
}
