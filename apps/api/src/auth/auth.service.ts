import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AUTH_CONTRACT } from './auth.contract';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || user.status !== AUTH_CONTRACT.activeStatus || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials.');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issue(user);
  }

  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new UnauthorizedException();
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash: hash(rawToken) }, include: { user: { include: { roles: { include: { role: true } } } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== AUTH_CONTRACT.activeStatus) throw new UnauthorizedException();
    await this.prisma.authSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    return this.accessPayload(session.user);
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) await this.prisma.authSession.updateMany({ where: { tokenHash: hash(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issue(user: any) {
    const rawRefreshToken = randomBytes(48).toString('base64url');
    await this.prisma.authSession.create({ data: { companyId: user.companyId, userId: user.id, tokenHash: hash(rawRefreshToken), expiresAt: new Date(Date.now() + AUTH_CONTRACT.refreshSessionDays * 86400_000) } });
    return { ...(await this.accessPayload(user)), rawRefreshToken };
  }

  private async accessPayload(user: any) {
    const roles = user.roles.filter((item: any) => item.companyId === user.companyId && item.role.companyId === user.companyId && item.role.isActive).map((item: any) => item.role.code);
    const accessToken = await this.jwt.signAsync({ sub: user.id, companyId: user.companyId, roles, scope: AUTH_CONTRACT.tokenScope });
    return { accessToken, user: { id: user.id, companyId: user.companyId, displayName: user.displayName, email: user.email, roles } };
  }
}
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
