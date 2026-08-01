import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AUTH_CONTRACT } from './auth.contract';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || user.status !== AUTH_CONTRACT.activeStatus) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const roles = user.roles
      .filter((item: { companyId: string; role: { companyId: string; isActive: boolean } }) =>
        item.companyId === user.companyId && item.role.companyId === user.companyId && item.role.isActive,
      )
      .map((item: { role: { code: string } }) => item.role.code);
    const payload = {
      sub: user.id,
      companyId: user.companyId,
      roles,
      scope: AUTH_CONTRACT.tokenScope,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        companyId: user.companyId,
        displayName: user.displayName,
        email: user.email,
        roles,
      },
    };
  }
}
