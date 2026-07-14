import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const CREDENTIAL_ID = 'turn-command-center';
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class TurnAdminService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly jwt: JwtService) {}

  async unlock(pin: string) {
    const credential = await this.getCredential();
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      throw new HttpException(`Acces blocat până la ${credential.lockedUntil.toISOString()}.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!(await bcrypt.compare(pin, credential.passwordHash))) {
      const failedAttempts = credential.failedAttempts + 1;
      const lockedUntil = failedAttempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60_000)
        : null;
      await this.prisma.turnAdminCredential.update({ where: { id: CREDENTIAL_ID }, data: { failedAttempts, lockedUntil } });
      if (lockedUntil) throw new HttpException('Prea multe încercări. Acces blocat 15 minute.', HttpStatus.TOO_MANY_REQUESTS);
      throw new UnauthorizedException(`PIN incorect. Încercări rămase: ${MAX_ATTEMPTS - failedAttempts}.`);
    }

    await this.prisma.turnAdminCredential.update({ where: { id: CREDENTIAL_ID }, data: { failedAttempts: 0, lockedUntil: null } });
    return {
      accessToken: await this.jwt.signAsync({ scope: 'turn-admin' }, { expiresIn: '15m' }),
      expiresInSeconds: 900,
    };
  }

  async changePin(authorization: string | undefined, currentPin: string, newPin: string) {
    await this.verifyToken(authorization);
    const credential = await this.getCredential();
    if (!(await bcrypt.compare(currentPin, credential.passwordHash))) throw new UnauthorizedException('PIN-ul curent este incorect.');
    const passwordHash = await bcrypt.hash(newPin, 12);
    await this.prisma.turnAdminCredential.update({
      where: { id: CREDENTIAL_ID },
      data: { passwordHash, failedAttempts: 0, lockedUntil: null },
    });
    return { changed: true };
  }

  async validate(authorization: string | undefined) {
    await this.verifyToken(authorization);
    return { valid: true };
  }

  private async getCredential() {
    const existing = await this.prisma.turnAdminCredential.findUnique({ where: { id: CREDENTIAL_ID } });
    if (existing) return existing;
    const passwordHash = this.config.get<string>('AGM_TURN_ADMIN_PIN_HASH');
    if (!passwordHash) throw new UnauthorizedException('PIN-ul administrativ AGM nu este configurat.');
    return this.prisma.turnAdminCredential.create({ data: { id: CREDENTIAL_ID, passwordHash } });
  }

  private async verifyToken(authorization: string | undefined) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    try {
      const payload = await this.jwt.verifyAsync<{ scope?: string }>(token, { secret: this.config.get<string>('JWT_SECRET', 'change-me-in-development') });
      if (payload.scope !== 'turn-admin') throw new Error('Invalid scope');
    } catch {
      throw new UnauthorizedException('Sesiunea administrativă a expirat.');
    }
  }
}
