import { ConflictException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  TURN_ADMIN_CONTRACT,
  type TurnAdminAuditAction,
  type TurnAdminAuditEvent,
  type TurnAdminAuditOutcome,
} from './turn-admin.contract';

const CREDENTIAL_ID = 'turn-command-center';

type TurnAccessPayload = {
  scope?: string;
  sid?: string;
  familyId?: string;
  generation?: number;
};

type TurnSession = {
  id: string;
  familyId: string;
  generation: number;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedAt: Date | null;
  reuseDetectedAt: Date | null;
  lastUsedAt: Date;
  createdAt: Date;
};

@Injectable()
export class TurnAdminService {
  private readonly logger = new Logger(TurnAdminService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly jwt: JwtService) {}

  async unlock(pin: string) {
    await this.purgeExpiredSessions();
    const credential = await this.getCredential();
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      this.audit('unlock', 'locked', 'attempt-limit');
      throw new HttpException(`Acces blocat până la ${credential.lockedUntil.toISOString()}.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!(await bcrypt.compare(pin, credential.passwordHash))) {
      const failedAttempts = credential.failedAttempts + 1;
      const lockedUntil = failedAttempts >= TURN_ADMIN_CONTRACT.maxFailedAttempts
        ? new Date(Date.now() + TURN_ADMIN_CONTRACT.lockMinutes * 60_000)
        : null;
      await this.updateCredential({ failedAttempts, lockedUntil });
      if (lockedUntil) {
        this.audit('unlock', 'locked', 'attempt-limit');
        throw new HttpException('Prea multe încercări. Acces blocat 15 minute.', HttpStatus.TOO_MANY_REQUESTS);
      }
      this.audit('unlock', 'denied', 'invalid-pin');
      throw new UnauthorizedException(`PIN incorect. Încercări rămase: ${TURN_ADMIN_CONTRACT.maxFailedAttempts - failedAttempts}.`);
    }

    if (credential.failedAttempts !== 0 || credential.lockedUntil !== null) {
      await this.updateCredential({ failedAttempts: 0, lockedUntil: null });
    }
    const result = await this.createSession();
    this.audit('unlock', 'allowed');
    return result;
  }

  async refresh(rawToken: string | undefined) {
    if (!rawToken) {
      this.audit('refresh', 'denied', 'invalid-session');
      throw new UnauthorizedException('Sesiunea administrativă nu poate fi reînnoită.');
    }

    const now = new Date();
    const session = await this.prisma.turnAdminSession.findUnique({ where: { tokenHash: hash(rawToken) } }) as TurnSession | null;
    if (!session) {
      this.audit('refresh', 'denied', 'invalid-session');
      throw new UnauthorizedException('Sesiunea administrativă nu poate fi reînnoită.');
    }
    if (session.revokedAt) return this.rejectRotatedToken(session, now);
    if (session.expiresAt <= now) {
      await this.revokeFamily(session.familyId, now, 'expired-session');
      this.audit('refresh', 'denied', 'expired-session');
      throw new UnauthorizedException('Sesiunea administrativă de reînnoire a expirat.');
    }

    const nextRawRefreshToken = randomBytes(48).toString('base64url');
    const nextId = randomUUID();
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.turnAdminSession.updateMany({
        where: { id: session.id, tokenHash: hash(rawToken), revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now, replacedAt: now, lastUsedAt: now },
      });
      if (claimed.count !== 1) return null;
      return transaction.turnAdminSession.create({
        data: {
          id: nextId,
          familyId: session.familyId,
          generation: session.generation + 1,
          tokenHash: hash(nextRawRefreshToken),
          expiresAt: session.expiresAt,
        },
      });
    }) as TurnSession | null;

    if (!rotated) {
      const latest = await this.prisma.turnAdminSession.findUnique({ where: { id: session.id } }) as TurnSession | null;
      if (latest?.replacedAt && withinConcurrencyGrace(latest.replacedAt, now)) {
        this.audit('refresh', 'denied', 'concurrent-refresh');
        throw new ConflictException('SESSION_REFRESH_IN_PROGRESS');
      }
      await this.revokeFamily(session.familyId, now, 'refresh-reuse');
      this.audit('refresh', 'denied', 'refresh-reuse');
      throw new UnauthorizedException('Reutilizarea tokenului de refresh a revocat sesiunea administrativă.');
    }

    this.audit('refresh', 'allowed');
    return this.issueAccess(rotated, nextRawRefreshToken);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const session = await this.prisma.turnAdminSession.findUnique({ where: { tokenHash: hash(rawToken) } }) as TurnSession | null;
    if (!session) return;
    await this.revokeFamily(session.familyId, new Date(), 'revoked');
    this.audit('logout', 'allowed', 'revoked');
  }

  async changePin(authorization: string | undefined, currentPin: string, newPin: string) {
    await this.verifyToken(authorization, 'change-pin');
    const credential = await this.getCredential();
    if (!(await bcrypt.compare(currentPin, credential.passwordHash))) {
      this.audit('change-pin', 'denied', 'invalid-pin');
      throw new UnauthorizedException('PIN-ul curent este incorect.');
    }
    const passwordHash = await bcrypt.hash(newPin, 12);
    await this.updateCredential({ passwordHash, failedAttempts: 0, lockedUntil: null });
    await this.prisma.turnAdminSession.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.audit('change-pin', 'allowed', 'revoked');
    return { changed: true };
  }

  async validate(authorization: string | undefined) {
    await this.verifyToken(authorization, 'validate');
    this.audit('validate', 'allowed');
    return { valid: true };
  }

  async requireOperationalAccess(authorization: string | undefined) {
    await this.verifyToken(authorization, 'validate');
  }

  async purgeExpiredSessions(now = new Date()) {
    const revokedBefore = new Date(now.getTime() - TURN_ADMIN_CONTRACT.revokedSessionRetentionDays * 86_400_000);
    return this.prisma.turnAdminSession.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { lte: revokedBefore } }] },
    });
  }

  private async createSession() {
    const rawRefreshToken = randomBytes(48).toString('base64url');
    const session = await this.prisma.turnAdminSession.create({
      data: {
        familyId: randomUUID(),
        generation: 0,
        tokenHash: hash(rawRefreshToken),
        expiresAt: new Date(Date.now() + TURN_ADMIN_CONTRACT.refreshSessionDays * 86_400_000),
      },
    }) as TurnSession;
    return this.issueAccess(session, rawRefreshToken);
  }

  private async issueAccess(session: TurnSession, rawRefreshToken: string) {
    const expiresInSeconds = this.accessTokenLifetimeSeconds();
    const accessToken = await this.jwt.signAsync(
      {
        scope: TURN_ADMIN_CONTRACT.tokenScope,
        sid: session.id,
        familyId: session.familyId,
        generation: session.generation,
      },
      { expiresIn: `${expiresInSeconds}s` },
    );
    return { accessToken, expiresInSeconds, rawRefreshToken };
  }

  private accessTokenLifetimeSeconds() {
    if (this.config.get<string>('NODE_ENV') !== 'test') return TURN_ADMIN_CONTRACT.sessionSeconds;
    const configured = Number(this.config.get<string>('AGM_TURN_ADMIN_TEST_ACCESS_TTL_SECONDS'));
    return Number.isInteger(configured) && configured >= 1 && configured <= TURN_ADMIN_CONTRACT.sessionSeconds
      ? configured
      : TURN_ADMIN_CONTRACT.sessionSeconds;
  }

  private async rejectRotatedToken(session: TurnSession, now: Date): Promise<never> {
    if (!session.replacedAt) {
      this.audit('refresh', 'denied', 'revoked');
      throw new UnauthorizedException('Sesiunea administrativă a fost revocată.');
    }
    if (session.replacedAt && withinConcurrencyGrace(session.replacedAt, now)) {
      this.audit('refresh', 'denied', 'concurrent-refresh');
      throw new ConflictException('SESSION_REFRESH_IN_PROGRESS');
    }
    await this.revokeFamily(session.familyId, now, 'refresh-reuse');
    this.audit('refresh', 'denied', 'refresh-reuse');
    throw new UnauthorizedException('Reutilizarea tokenului de refresh a revocat sesiunea administrativă.');
  }

  private async revokeFamily(familyId: string, now: Date, reason: 'expired-session' | 'refresh-reuse' | 'revoked') {
    await this.prisma.turnAdminSession.updateMany({
      where: { familyId, revokedAt: null },
      data: {
        revokedAt: now,
        ...(reason === 'refresh-reuse' ? { reuseDetectedAt: now } : {}),
      },
    });
  }

  private async getCredential() {
    const existing = await this.prisma.turnAdminCredential.findUnique({ where: { id: CREDENTIAL_ID } });
    if (existing) return existing;
    const passwordHash = this.config.get<string>('AGM_TURN_ADMIN_PIN_HASH');
    if (!passwordHash) throw new UnauthorizedException('PIN-ul administrativ AGM nu este configurat.');
    return this.prisma.turnAdminCredential.create({ data: { id: CREDENTIAL_ID, passwordHash } });
  }

  private async updateCredential(data: { passwordHash?: string; failedAttempts?: number; lockedUntil?: Date | null }) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe('SET TRANSACTION READ WRITE');
      return transaction.turnAdminCredential.update({ where: { id: CREDENTIAL_ID }, data });
    });
  }

  private async verifyToken(authorization: string | undefined, action: Extract<TurnAdminAuditAction, 'validate' | 'change-pin'>) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    try {
      const payload = await this.jwt.verifyAsync<TurnAccessPayload>(token, { secret: this.config.getOrThrow<string>('JWT_SECRET') });
      if (
        payload.scope !== TURN_ADMIN_CONTRACT.tokenScope ||
        !payload.sid || !payload.familyId || !Number.isInteger(payload.generation)
      ) throw new Error('Invalid scope or session binding');
      const session = await this.prisma.turnAdminSession.findUnique({ where: { id: payload.sid } }) as TurnSession | null;
      if (
        !session || session.revokedAt || session.expiresAt <= new Date() ||
        session.familyId !== payload.familyId || session.generation !== payload.generation
      ) throw new Error('Invalid or revoked session');
      await this.prisma.turnAdminSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      this.audit(action, 'denied', 'invalid-session');
      throw new UnauthorizedException('Sesiunea administrativă a expirat sau a fost revocată.');
    }
  }

  private audit(action: TurnAdminAuditAction, outcome: TurnAdminAuditOutcome, reason?: TurnAdminAuditEvent['reason']) {
    const event: TurnAdminAuditEvent = {
      contract: TURN_ADMIN_CONTRACT.version,
      action,
      outcome,
      occurredAt: new Date().toISOString(),
      ...(reason ? { reason } : {}),
    };
    const message = JSON.stringify(event);
    if (outcome === 'allowed') this.logger.log(message);
    else this.logger.warn(message);
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function withinConcurrencyGrace(replacedAt: Date, now: Date) {
  const elapsed = now.getTime() - replacedAt.getTime();
  return elapsed >= -TURN_ADMIN_CONTRACT.clockSkewToleranceSeconds * 1_000
    && elapsed <= TURN_ADMIN_CONTRACT.refreshConcurrencyGraceSeconds * 1_000;
}
