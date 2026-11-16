import { createHash, randomUUID } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/request-context';

export const CREDENTIAL_SUBJECTS = ['premium.architecture-inspector', 'premium.recovery-executor'] as const;
export const CREDENTIAL_WARNING_MS = 12 * 60 * 60 * 1000;
type Credential = { id: string; version: number; expiresAt: Date; revokedAt: Date | null; createdAt: Date; lastUsedAt: Date | null };
type Identity = { id: string; subject: string; status: string; credentials: Credential[] };

export function credentialReadiness(identity: Identity | undefined, now: Date) {
  const latest = identity?.credentials.slice().sort((a, b) => b.version - a.version)[0];
  const state = !identity ? 'MISSING' : identity.status !== 'ACTIVE' ? 'INACTIVE'
    : !latest || latest.revokedAt ? 'UNAVAILABLE' : latest.expiresAt <= now ? 'EXPIRED'
    : latest.expiresAt.getTime() - now.getTime() <= CREDENTIAL_WARNING_MS ? 'EXPIRING'
    : !latest.lastUsedAt || latest.lastUsedAt < latest.createdAt ? 'UNVERIFIED' : 'READY';
  return { state, credentialId: latest?.id ?? null, version: latest?.version ?? null,
    expiresAt: latest?.expiresAt.toISOString() ?? null, authenticationObserved: Boolean(latest?.lastUsedAt && latest.lastUsedAt >= latest.createdAt) };
}

// Observation only: never rotates, grants roles, reads secretHash or changes Guardian/RK.
// Transition receipts use the existing ACP journal and serialize competing duty runs.
export async function inspectCredentialReadiness(db: PrismaService, ctx: RequestContext, now = new Date()) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.companyId + ':credential-readiness'}))`;
    const identities = await tx.machineIdentity.findMany({ where: { companyId: ctx.companyId, subject: { in: [...CREDENTIAL_SUBJECTS] } },
      select: { id: true, subject: true, status: true, credentials: { orderBy: { version: 'desc' }, take: 1,
        select: { id: true, version: true, expiresAt: true, revokedAt: true, createdAt: true, lastUsedAt: true } } } });
    if (identities.length === 0 && ctx.companyId !== '00000000-0000-0000-0000-000000000001') {
      return { passed: true, applicable: false, observations: [], evidenceReferences: [] };
    }
    const observations = [];
    const evidenceReferences: string[] = [];
    for (const subject of CREDENTIAL_SUBJECTS) {
      const current = { subject, ...credentialReadiness(identities.find(i => i.subject === subject), now) };
      const previous = await tx.authorityAuditJournal.findFirst({ where: { companyId: ctx.companyId, scopeId: 'credential-lifecycle', actorId: subject }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] });
      const before = previous?.safeMetadata as { state?: string; credentialId?: string } | undefined;
      if (before?.state !== current.state || before?.credentialId !== current.credentialId) {
        const eventType = current.state === 'READY' ? (before ? 'M2M_CREDENTIAL_RECOVERED' : 'M2M_CREDENTIAL_READY')
          : current.state === 'EXPIRING' ? 'M2M_CREDENTIAL_EXPIRY_WARNING' : 'M2M_CREDENTIAL_ESCALATED';
        const eventId = randomUUID();
        await tx.authorityAuditJournal.create({ data: { companyId: ctx.companyId, eventId, eventType,
          scopeId: 'credential-lifecycle', actorType: 'AGENT', actorId: subject,
          outcome: current.state === 'READY' ? 'PASS' : 'FAIL', reasonCode: `M2M_CREDENTIAL_${current.state}`,
          payloadHash: createHash('sha256').update(JSON.stringify(current)).digest('hex'),
          safeMetadata: { ...current, observer: 'agm.authority.control-plane', responsible: 'RELEASE_OPERATIONS',
            escalationTo: 'TURN_COMMANDER_AND_SECRET_CREDENTIALS_GUARDIAN', priorEventId: previous?.eventId ?? null,
            incidentRef: `m2m-credential:${ctx.companyId}:${subject}`,
            custodyPublicationClaimed: false }, correlationId: ctx.correlationId, occurredAt: now } });
        evidenceReferences.push(`AuthorityAuditJournal:${eventId}`);
      } else if (previous) evidenceReferences.push(`AuthorityAuditJournal:${previous.eventId}`);
      observations.push(current);
    }
    return { passed: observations.every(x => x.state === 'READY'), applicable: true, observations, evidenceReferences };
  });
}
