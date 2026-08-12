DROP TABLE IF EXISTS "CarMoverJob";
DROP TABLE IF EXISTS "CarMoverVehicleSubject";
DROP INDEX IF EXISTS "OperationalEvent_companyId_productId_subjectType_subjectId_occurredAt_idx";
DROP INDEX IF EXISTS "OperationalEventStream_companyId_productId_subjectType_subjectId_idx";
DROP INDEX IF EXISTS "AuditEvent_companyId_productId_subjectType_subjectId_occurredAt_idx";
ALTER TABLE "OperationalEvent" DROP COLUMN IF EXISTS "subjectId", DROP COLUMN IF EXISTS "subjectType", DROP COLUMN IF EXISTS "moduleId", DROP COLUMN IF EXISTS "productId";
ALTER TABLE "OperationalEventStream" DROP COLUMN IF EXISTS "subjectId", DROP COLUMN IF EXISTS "subjectType", DROP COLUMN IF EXISTS "moduleId", DROP COLUMN IF EXISTS "productId";
ALTER TABLE "AuditEvent" DROP COLUMN IF EXISTS "subjectId", DROP COLUMN IF EXISTS "subjectType", DROP COLUMN IF EXISTS "moduleId", DROP COLUMN IF EXISTS "productId";
