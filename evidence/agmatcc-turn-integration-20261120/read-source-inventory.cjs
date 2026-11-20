// Operator-authorized production metadata audit. Never a substitute for caller-authenticated HTTP E2E.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const companyId = '00000000-0000-0000-0000-000000000001';
(async () => {
  const sources = [];
  for (const model of ['operationalEvent', 'incidentReport', 'agentRuntimeEvent', 'componentHeartbeat', 'authorityAuditJournal', 'premiumNetworkRegistryEntry', 'authorityMandate', 'authorityDecision', 'evidenceMetadata']) {
    try { sources.push({ model, count: await prisma[model].count({ where: { companyId } }), state: 'READABLE_VIA_OPERATIONS_DB', callerHttpAuthorizationTested: false }); }
    catch (error) { sources.push({ model, state: 'READ_FAILED', errorCode: error.code ?? error.name }); }
  }
  const modules = await prisma.operationalEvent.groupBy({ by: ['moduleId'], where: { companyId }, _count: { _all: true } });
  console.log(JSON.stringify({ at: new Date().toISOString(), scope: 'Read-only metadata via existing release-operations identity; not Luna or TURN user E2E', sources, operationalEventModules: modules }));
})().finally(() => prisma.$disconnect());
