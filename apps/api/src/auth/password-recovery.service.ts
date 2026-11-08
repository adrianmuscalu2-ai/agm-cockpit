import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { GmailCommunicationProvider } from '../communications/providers/gmail.provider';

const ACCEPTED = { accepted: true } as const;
const INVALID = 'PASSWORD_RESET_INVALID_OR_EXPIRED';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(private readonly prisma: PrismaService, private readonly email: GmailCommunicationProvider) {}

  async request(address: string) {
    // Availability is checked before account lookup; this cannot disclose an account.
    if (!this.email.configured()) throw new ServiceUnavailableException('PASSWORD_RECOVERY_DELIVERY_UNAVAILABLE');
    const candidates = await this.prisma.user.findMany({
      where: { email: { equals: address.trim(), mode: 'insensitive' }, status: 'Active', company: { isActive: true } },
      select: { id: true, companyId: true, email: true, credentialVersion: true }, take: 2,
    });
    if (candidates.length !== 1) return ACCEPTED;
    const user = candidates[0];
    const now = new Date();
    const recent = await this.prisma.passwordResetChallenge.findFirst({
      where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 60_000) } }, select: { id: true },
    });
    if (recent) return ACCEPTED;
    const token = randomBytes(32).toString('base64url');
    const challenge = await this.prisma.passwordResetChallenge.create({ data: {
      userId: user.id, companyId: user.companyId, credentialVersion: user.credentialVersion,
      tokenHash: digest(token), expiresAt: new Date(now.getTime() + 15 * 60_000),
    }, select: { id: true } });
    // Do not wait for provider latency: response shape and delivery time must not
    // reveal whether an address exists. Only the digest is persisted. A restart
    // before delivery requires a new request; no raw-token outbox is introduced.
    void this.deliver(challenge.id, user.email, token);
    return ACCEPTED;
  }

  private async deliver(challengeId: string, address: string, token: string) {
    try {
      await this.email.send({
        contractVersion: 'communication-message.v1', clientMessageId: randomUUID(), channel: 'email',
        to: address, subject: '[AGM ACCOUNT RECOVERY] Recuperare parola / Password recovery',
        bodyText: [
          'Ati solicitat schimbarea parolei contului AGM.',
          'Deschideti acest link pentru a alege o parola noua. Linkul expira in 15 minute si poate fi folosit o singura data.',
          `https://app.agmcockpit.com/access#password-reset=${token}`,
          'PIN-ul TURN ramane neschimbat. Daca nu ati solicitat aceasta operatiune, ignorati mesajul.',
        ].join('\n\n'),
      });
      await this.prisma.passwordResetChallenge.update({ where: { id: challengeId }, data: { deliveredAt: new Date() } });
    } catch {
      // Never log provider bodies, destination, password, or recovery link.
      this.logger.error('PASSWORD_RECOVERY_DELIVERY_FAILED');
      try {
        await this.prisma.passwordResetChallenge.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
      } catch { this.logger.error('PASSWORD_RECOVERY_INVALIDATION_FAILED'); }
    }
  }

  async confirm(token: string, password: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new BadRequestException(INVALID);
    if (Array.from(password).length < 8 || Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('PASSWORD_LENGTH_INVALID');
    const now = new Date();
    const challenge = await this.prisma.passwordResetChallenge.findUnique({ where: { tokenHash: digest(token) } });
    if (!challenge || challenge.consumedAt || !challenge.deliveredAt || challenge.expiresAt <= now) throw new BadRequestException(INVALID);
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async tx => {
      const updated = await tx.user.updateMany({
        where: { id: challenge.userId, companyId: challenge.companyId, credentialVersion: challenge.credentialVersion, status: 'Active', company: { isActive: true } },
        data: { passwordHash, credentialVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new BadRequestException(INVALID);
      const claimed = await tx.passwordResetChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, deliveredAt: { not: null }, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) throw new BadRequestException(INVALID);
      await tx.authSession.updateMany({ where: { userId: challenge.userId, companyId: challenge.companyId, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetChallenge.updateMany({ where: { userId: challenge.userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.auditEvent.create({ data: {
        companyId: challenge.companyId, actorUserId: challenge.userId, actorType: 'User',
        actionCode: 'AUTH_PASSWORD_RECOVERED', entityType: 'User', entityId: challenge.userId,
        requestId: randomUUID(), correlationId: randomUUID(),
        metadata: { ownershipProof: 'SINGLE_USE_EMAIL_LINK', sessionsRevoked: true, credentialVersion: challenge.credentialVersion + 1 },
      } });
    });
    return { passwordChanged: true, signInRequired: true };
  }
}

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
