const { JwtService } = require('@nestjs/jwt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const endpoint = process.env.AGM_GUARDIAN_NEGATIVE_CONTROL_URL
  || 'https://api.agmcockpit.com/api/v1/security/permission-guardian/evaluate';

async function main() {
  if (process.env.NODE_ENV !== 'production') throw new Error('PRODUCTION_RUNTIME_REQUIRED');
  if (!/^https:\/\/api\.agmcockpit\.com\//.test(endpoint)) throw new Error('CANONICAL_PRODUCTION_ENDPOINT_REQUIRED');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET_UNAVAILABLE');

  const user = await prisma.user.findFirst({
    where: { status: 'Active', company: { isActive: true } },
    include: { roles: { include: { role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) throw new Error('ACTIVE_PRODUCTION_PRINCIPAL_UNAVAILABLE');

  const roles = user.roles
    .filter((entry) => entry.companyId === user.companyId && entry.role.companyId === user.companyId && entry.role.isActive)
    .map((entry) => entry.role.code);
  const token = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync(
    { sub: user.id, companyId: user.companyId, roles, scope: 'user' },
    { expiresIn: '60s' },
  );
  const releaseRef = `${process.env.AGM_REVISION || 'unknown'}:${process.env.AGM_RELEASE_RUN_ID || 'manual'}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase: 'EXECUTION',
      requestedCapability: 'NAVIGATION',
      requestedPermissionOrScope: 'android.permission.ACCESS_FINE_LOCATION',
      requestor: 'agm.production-release.negative-control',
      reason: 'Prove fail-closed handling for an Android scope that AGM does not allow.',
      risk: 'HIGH',
      currentAuthority: 'DENIED',
      evidence: `controlled-production-negative:${releaseRef}`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GUARDIAN_HTTP_${response.status}`);
  const envelope = await response.json();
  const evaluation = envelope?.data;
  if (
    evaluation?.decision !== 'DENIED'
    || evaluation?.authorityGranted !== false
    || evaluation?.reasonCode !== 'PERMISSION_OR_SCOPE_NOT_ALLOWLISTED'
    || typeof evaluation?.evidenceId !== 'string'
  ) throw new Error('GUARDIAN_FAIL_CLOSED_CONTRACT_MISMATCH');

  const persistedEvaluation = await prisma.authorityAuditJournal.findFirst({
    where: {
      companyId: user.companyId,
      eventId: evaluation.evidenceId,
      eventType: 'PERMISSION_GUARDIAN_EVALUATION',
      outcome: 'DENIED',
    },
  });
  const findingCandidates = await prisma.authorityAuditJournal.findMany({
    where: {
      companyId: user.companyId,
      eventType: 'PERMISSION_GUARDIAN_CONTROL_FINDING',
      outcome: 'OPEN',
      occurredAt: { gte: persistedEvaluation?.occurredAt },
    },
    orderBy: { occurredAt: 'desc' },
    take: 10,
  });
  const finding = findingCandidates.find((event) => event.safeMetadata?.evaluationEventId === evaluation.evidenceId);
  if (!persistedEvaluation || !finding || finding.safeMetadata?.authorityGranted !== false) {
    throw new Error('GUARDIAN_PRODUCTION_EVIDENCE_NOT_PERSISTED');
  }

  process.stdout.write(JSON.stringify({
    contract: 'permission-guardian-production-negative-control.v1',
    status: 'PASS',
    decision: evaluation.decision,
    authorityGranted: evaluation.authorityGranted,
    reasonCode: evaluation.reasonCode,
    evaluationEventId: evaluation.evidenceId,
    findingEventId: finding.eventId,
  }));
}

main()
  .catch((error) => {
    process.stderr.write(`GUARDIAN_PRODUCTION_NEGATIVE_CONTROL_FAIL ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
