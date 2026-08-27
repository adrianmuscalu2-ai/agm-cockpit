import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AUTH_CONTRACT } from './auth.contract';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    await this.purgeExpiredSessions();
    const user = await this.users.findByEmail(email);
    if (!user || user.status !== AUTH_CONTRACT.activeStatus || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials.');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issue(user);
  }

  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new UnauthorizedException();
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash: hash(rawToken) }, include: { user: { include: { roles: { include: { role: true } } } } } });
    if (!session) throw new UnauthorizedException();
    if (session.revokedAt) {
      await this.prisma.authSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date(), reuseDetectedAt: new Date() },
      });
      throw new UnauthorizedException();
    }
    if (session.expiresAt <= new Date() || session.user.status !== AUTH_CONTRACT.activeStatus) throw new UnauthorizedException();
    const nextRawRefreshToken = randomBytes(48).toString('base64url');
    const now = new Date();
    const rotated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.authSession.updateMany({
        where: { id: session.id, tokenHash: hash(rawToken), revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now, replacedAt: now, lastUsedAt: now },
      });
      if (claimed.count !== 1) return false;
      await tx.authSession.create({ data: {
        companyId: session.companyId, userId: session.userId, familyId: session.familyId,
        generation: session.generation + 1, tokenHash: hash(nextRawRefreshToken), expiresAt: session.expiresAt,
      } });
      return true;
    });
    if (!rotated) {
      await this.prisma.authSession.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: now, reuseDetectedAt: now } });
      throw new UnauthorizedException();
    }
    return { ...(await this.accessPayload(session.user)), rawRefreshToken: nextRawRefreshToken };
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) await this.prisma.authSession.updateMany({ where: { tokenHash: hash(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async purgeExpiredSessions(now = new Date()) {
    const revokedBefore = new Date(now.getTime() - AUTH_CONTRACT.revokedSessionRetentionDays * 86400_000);
    return this.prisma.authSession.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { lte: revokedBefore } }] },
    });
  }

  private async issue(user: AuthUser) {
    const rawRefreshToken = randomBytes(48).toString('base64url');
    await this.prisma.authSession.create({ data: { companyId: user.companyId, userId: user.id, familyId: randomUUID(), generation: 0, tokenHash: hash(rawRefreshToken), expiresAt: new Date(Date.now() + AUTH_CONTRACT.refreshSessionDays * 86400_000) } });
    return { ...(await this.accessPayload(user)), rawRefreshToken };
  }

  private async accessPayload(user: AuthUser) {
    const roles = user.roles.filter((item) => item.companyId === user.companyId && item.role.companyId === user.companyId && item.role.isActive).map((item) => item.role.code);
    const accessToken = await this.jwt.signAsync({ sub: user.id, companyId: user.companyId, roles, scope: AUTH_CONTRACT.tokenScope });
    return { accessToken, user: { id: user.id, companyId: user.companyId, displayName: user.displayName, email: user.email, roles } };
  }
}
type AuthUser = Prisma.UserGetPayload<{ include: { roles: { include: { role: true } } } }>;
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
