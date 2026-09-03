import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type MachineCredential, type MachineIdentity } from '@prisma/client';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { MACHINE_AUTH_CONTRACT, type MachineJwtPayload, type MachineRequestContext } from './machine-auth.contract';

type CredentialWithIdentity = MachineCredential & { identity: MachineIdentity };

@Injectable()
export class MachineAuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async provision(subject: string, expiresInDays: number, ctx: RequestContext) {
    requireProvisioningAuthority(ctx);
    const credentialId = randomUUID();
    const rawSecret = createCredentialSecret(credentialId);
    const expiresAt = credentialExpiry(expiresInDays);
    const result = await this.prisma.$transaction(async (tx) => {
      const identity = await tx.machineIdentity.create({
        data: {
          companyId: ctx.companyId,
          subject,
          issuer: MACHINE_AUTH_CONTRACT.issuer,
          audience: MACHINE_AUTH_CONTRACT.audience,
          scopes: [MACHINE_AUTH_CONTRACT.scope],
        },
      });
      const credential = await tx.machineCredential.create({
        data: { id: credentialId, identityId: identity.id, secretHash: hash(rawSecret), expiresAt },
      });
      await this.audit(tx, {
        companyId: identity.companyId,
        actorType: 'User',
        actorUserId: ctx.userId,
        actionCode: 'M2M_IDENTITY_PROVISIONED',
        entityType: 'MachineIdentity',
        entityId: identity.id,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        metadata: { subject: identity.subject, credentialId: credential.id, scopes: [MACHINE_AUTH_CONTRACT.scope], expiresAt },
      });
      return { identity, credential };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return credentialResponse(result.identity, result.credential, rawSecret);
  }

  async rotate(identityId: string, expiresInDays: number, ctx: RequestContext) {
    requireProvisioningAuthority(ctx);
    const credentialId = randomUUID();
    const rawSecret = createCredentialSecret(credentialId);
    const expiresAt = credentialExpiry(expiresInDays);
    const result = await this.prisma.$transaction(async (tx) => {
      const identity = await tx.machineIdentity.findFirst({ where: { id: identityId, companyId: ctx.companyId } });
      if (!identity) throw new NotFoundException('Machine identity not found in the current tenant.');
      if (identity.status !== MACHINE_AUTH_CONTRACT.activeIdentityStatus) throw new ForbiddenException('Machine identity is not active.');
      const latest = await tx.machineCredential.findFirst({ where: { identityId: identity.id }, orderBy: { version: 'desc' } });
      const revokedAt = new Date();
      await tx.machineCredential.updateMany({ where: { identityId: identity.id, revokedAt: null }, data: { revokedAt } });
      const credential = await tx.machineCredential.create({
        data: { id: credentialId, identityId: identity.id, secretHash: hash(rawSecret), version: (latest?.version ?? 0) + 1, expiresAt },
      });
      await this.audit(tx, {
        companyId: identity.companyId,
        actorType: 'User',
        actorUserId: ctx.userId,
        actionCode: 'M2M_CREDENTIAL_ROTATED',
        entityType: 'MachineIdentity',
        entityId: identity.id,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        metadata: { credentialId: credential.id, version: credential.version, priorCredentialsRevokedAt: revokedAt, expiresAt },
      });
      return { identity, credential };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return credentialResponse(result.identity, result.credential, rawSecret);
  }

  async revoke(identityId: string, credentialId: string, reason: string, ctx: RequestContext) {
    requireProvisioningAuthority(ctx);
    return this.prisma.$transaction(async (tx) => {
      const credential = await tx.machineCredential.findFirst({
        where: { id: credentialId, identityId, identity: { companyId: ctx.companyId } },
        include: { identity: true },
      });
      if (!credential) throw new NotFoundException('Machine credential not found in the current tenant.');
      const revokedAt = credential.revokedAt ?? new Date();
      if (!credential.revokedAt) await tx.machineCredential.update({ where: { id: credential.id }, data: { revokedAt } });
      await this.audit(tx, {
        companyId: credential.identity.companyId,
        actorType: 'User',
        actorUserId: ctx.userId,
        actionCode: 'M2M_CREDENTIAL_REVOKED',
        entityType: 'MachineCredential',
        entityId: credential.id,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        metadata: { identityId: credential.identity.id, reason, revokedAt, idempotent: Boolean(credential.revokedAt) },
      });
      return { identityId: credential.identity.id, credentialId: credential.id, revokedAt, idempotent: Boolean(credential.revokedAt) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revokeIdentity(identityId: string, reason: string, ctx: RequestContext) {
    requireProvisioningAuthority(ctx);
    return this.prisma.$transaction(async (tx) => {
      const identity = await tx.machineIdentity.findFirst({ where: { id: identityId, companyId: ctx.companyId } });
      if (!identity) throw new NotFoundException('Machine identity not found in the current tenant.');
      const revokedAt = new Date();
      const idempotent = identity.status !== MACHINE_AUTH_CONTRACT.activeIdentityStatus;
      if (!idempotent) await tx.machineIdentity.update({ where: { id: identity.id }, data: { status: 'REVOKED' } });
      await tx.machineCredential.updateMany({ where: { identityId: identity.id, revokedAt: null }, data: { revokedAt } });
      await this.audit(tx, {
        companyId: identity.companyId,
        actorType: 'User',
        actorUserId: ctx.userId,
        actionCode: 'M2M_IDENTITY_REVOKED',
        entityType: 'MachineIdentity',
        entityId: identity.id,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        metadata: { reason, revokedAt, idempotent },
      });
      return { identityId: identity.id, status: 'REVOKED', revokedAt, idempotent };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async issueToken(clientId: string, rawSecret: string) {
    const credentialId = credentialIdFromSecret(rawSecret);
    if (!credentialId) throw invalidClient();
    const credential = await this.prisma.machineCredential.findUnique({ where: { id: credentialId }, include: { identity: true } });
    if (!isCredentialUsable(credential, clientId, rawSecret)) throw invalidClient();
    const identity = credential.identity;
    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync(
      {
        sub: identity.subject,
        companyId: identity.companyId,
        client_id: identity.id,
        credential_id: credential.id,
        scope: MACHINE_AUTH_CONTRACT.scope,
        token_use: MACHINE_AUTH_CONTRACT.tokenUse,
        jti,
      },
      {
        issuer: MACHINE_AUTH_CONTRACT.issuer,
        audience: MACHINE_AUTH_CONTRACT.audience,
        expiresIn: MACHINE_AUTH_CONTRACT.accessTokenExpiresInSeconds,
      },
    );
    await this.audit(this.prisma, {
      companyId: identity.companyId,
      actorType: 'Machine',
      actionCode: 'M2M_TOKEN_ISSUED',
      entityType: 'MachineCredential',
      entityId: credential.id,
      metadata: { identityId: identity.id, subject: identity.subject, scope: MACHINE_AUTH_CONTRACT.scope, jti },
    });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: MACHINE_AUTH_CONTRACT.accessTokenExpiresInSeconds,
      scope: MACHINE_AUTH_CONTRACT.scope,
    };
  }

  async validateAccess(payload: MachineJwtPayload): Promise<MachineRequestContext> {
    if (!hasCanonicalClaims(payload)) throw new UnauthorizedException();
    const credential = await this.prisma.machineCredential.findUnique({ where: { id: payload.credential_id }, include: { identity: true } });
    if (!isCredentialBoundToClaims(credential, payload)) throw new UnauthorizedException();
    const requestId = randomUUID();
    const correlationId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.machineCredential.updateMany({
        where: { id: credential.id, identityId: credential.identity.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { lastUsedAt: new Date() },
      });
      if (updated.count !== 1) throw new UnauthorizedException();
      await this.audit(tx, {
        companyId: credential.identity.companyId,
        actorType: 'Machine',
        actionCode: 'M2M_CREDENTIAL_USED',
        entityType: 'MachineCredential',
        entityId: credential.id,
        requestId,
        correlationId,
        metadata: { identityId: credential.identity.id, subject: credential.identity.subject, scope: MACHINE_AUTH_CONTRACT.scope },
      });
    });
    return {
      requestId,
      correlationId,
      companyId: credential.identity.companyId,
      subject: credential.identity.subject,
      machineIdentityId: credential.identity.id,
      credentialId: credential.id,
      scopes: [MACHINE_AUTH_CONTRACT.scope],
    };
  }

  private audit(tx: Prisma.TransactionClient | PrismaService, input: {
    companyId: string;
    actorType: 'User' | 'Machine';
    actorUserId?: string;
    actionCode: string;
    entityType: string;
    entityId: string;
    requestId?: string;
    correlationId?: string;
    metadata: unknown;
  }) {
    return tx.auditEvent.create({ data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      actionCode: input.actionCode,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: 'Canonical machine-to-machine authentication lifecycle.',
      requestId: uuidOrNew(input.requestId),
      correlationId: uuidOrNew(input.correlationId),
      metadata: input.metadata as Prisma.InputJsonValue,
      productId: 'agm-cockpit',
      moduleId: 'machine-auth',
      subjectType: input.entityType,
      subjectId: input.entityId,
    } });
  }
}

function requireProvisioningAuthority(ctx: RequestContext) {
  if (!MACHINE_AUTH_CONTRACT.provisioningRoles.some((role) => ctx.roles.includes(role))) {
    throw new ForbiddenException('Machine identity provisioning requires tenant owner authority.');
  }
}

function credentialExpiry(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

function createCredentialSecret(credentialId: string) {
  return `${credentialId}.${randomBytes(48).toString('base64url')}`;
}

function credentialIdFromSecret(secret: string) {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.[A-Za-z0-9_-]{64}$/i.exec(secret);
  return match?.[1];
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function hashesEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function scopes(value: Prisma.JsonValue) {
  return Array.isArray(value) && value.every((item): item is string => typeof item === 'string') ? value : [];
}

function hasCanonicalClaims(payload: MachineJwtPayload) {
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  return payload.iss === MACHINE_AUTH_CONTRACT.issuer
    && audience.length === 1
    && audience[0] === MACHINE_AUTH_CONTRACT.audience
    && payload.scope === MACHINE_AUTH_CONTRACT.scope
    && payload.token_use === MACHINE_AUTH_CONTRACT.tokenUse;
}

function isCredentialUsable(credential: CredentialWithIdentity | null, clientId: string, rawSecret: string): credential is CredentialWithIdentity {
  if (!credential || credential.identity.id !== clientId || credential.identity.status !== MACHINE_AUTH_CONTRACT.activeIdentityStatus) return false;
  if (credential.revokedAt || credential.expiresAt <= new Date()) return false;
  if (credential.identity.issuer !== MACHINE_AUTH_CONTRACT.issuer || credential.identity.audience !== MACHINE_AUTH_CONTRACT.audience) return false;
  if (!scopes(credential.identity.scopes).includes(MACHINE_AUTH_CONTRACT.scope)) return false;
  return hashesEqual(credential.secretHash, hash(rawSecret));
}

function isCredentialBoundToClaims(credential: CredentialWithIdentity | null, payload: MachineJwtPayload): credential is CredentialWithIdentity {
  if (!credential || credential.revokedAt || credential.expiresAt <= new Date()) return false;
  const identity = credential.identity;
  return identity.status === MACHINE_AUTH_CONTRACT.activeIdentityStatus
    && identity.id === payload.client_id
    && identity.companyId === payload.companyId
    && identity.subject === payload.sub
    && identity.issuer === MACHINE_AUTH_CONTRACT.issuer
    && identity.audience === MACHINE_AUTH_CONTRACT.audience
    && scopes(identity.scopes).includes(MACHINE_AUTH_CONTRACT.scope);
}

function invalidClient() {
  return new UnauthorizedException('invalid_client');
}

function uuidOrNew(value?: string) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : randomUUID();
}

function credentialResponse(identity: MachineIdentity, credential: MachineCredential, clientSecret: string) {
  return {
    clientId: identity.id,
    clientSecret,
    credentialId: credential.id,
    subject: identity.subject,
    companyId: identity.companyId,
    scopes: [MACHINE_AUTH_CONTRACT.scope],
    expiresAt: credential.expiresAt,
  };
}
