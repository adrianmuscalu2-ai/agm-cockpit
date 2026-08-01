import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { AUTH_CONTRACT } from './auth.contract';

interface JwtPayload {
  sub: string;
  companyId: string;
  roles: string[];
  scope?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (
      !user ||
      user.status !== AUTH_CONTRACT.activeStatus ||
      user.companyId !== payload.companyId ||
      payload.scope !== AUTH_CONTRACT.tokenScope
    ) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      companyId: user.companyId,
      roles: user.roles
        .filter((item: { companyId: string; role: { companyId: string; isActive: boolean } }) =>
          item.companyId === user.companyId && item.role.companyId === user.companyId && item.role.isActive,
        )
        .map((item: { role: { code: string } }) => item.role.code),
      requestId: '',
      correlationId: '',
    };
  }
}
