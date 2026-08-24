import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  TURN_ADMIN_CONTRACT,
  type TurnAdminAuditAction,
  type TurnAdminAuditEvent,
  type TurnAdminAuditOutcome,
} from './turn-admin.contract';

const CREDENTIAL_ID = 'turn-command-center';

@Injectable()
export class TurnAdminService {
  private readonly logger = new Logger(TurnAdminService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly jwt: JwtService) {}

  async unlock(pin: string) {
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
    this.audit('unlock', 'allowed');
    return {
      accessToken: await this.jwt.signAsync(
        { scope: TURN_ADMIN_CONTRACT.tokenScope },
        { expiresIn: `${TURN_ADMIN_CONTRACT.sessionSeconds}s` },
      ),
      expiresInSeconds: TURN_ADMIN_CONTRACT.sessionSeconds,
    };
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
    this.audit('change-pin', 'allowed');
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

  private async getCredential() {
    const existing = await this.prisma.turnAdminCredential.findUnique({ where: { id: CREDENTIAL_ID } });
    if (existing) return existing;
    const passwordHash = this.config.get<string>('AGM_TURN_ADMIN_PIN_HASH');
    if (!passwordHash) throw new UnauthorizedException('PIN-ul administrativ AGM nu este configurat.');
    return this.prisma.turnAdminCredential.create({ data: { id: CREDENTIAL_ID, passwordHash } });
  }

  private async updateCredential(data: { passwordHash?: string; failedAttempts?: number; lockedUntil?: Date | null }) {
    return this.prisma.$transaction(async (transaction) => {
      // Credential writes are deliberately scoped to this transaction. The shared
      // database role remains read-only for every other application operation.
      await transaction.$executeRawUnsafe('SET TRANSACTION READ WRITE');
      return transaction.turnAdminCredential.update({ where: { id: CREDENTIAL_ID }, data });
    });
  }

  private async verifyToken(authorization: string | undefined, action: Extract<TurnAdminAuditAction, 'validate' | 'change-pin'>) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    try {
      const payload = await this.jwt.verifyAsync<{ scope?: string }>(token, { secret: this.config.getOrThrow<string>('JWT_SECRET') });
      if (payload.scope !== TURN_ADMIN_CONTRACT.tokenScope) throw new Error('Invalid scope');
    } catch {
      this.audit(action, 'denied', 'invalid-session');
      throw new UnauthorizedException('Sesiunea administrativă a expirat.');
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
