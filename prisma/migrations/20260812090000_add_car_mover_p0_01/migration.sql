ALTER TABLE "AuditEvent" ADD COLUMN "productId" VARCHAR(48) NOT NULL DEFAULT 'agm-cockpit';
ALTER TABLE "AuditEvent" ADD COLUMN "moduleId" VARCHAR(80) NOT NULL DEFAULT 'cockpit-core';
ALTER TABLE "AuditEvent" ADD COLUMN "subjectType" VARCHAR(64) NOT NULL DEFAULT 'TransportJob';
ALTER TABLE "AuditEvent" ADD COLUMN "subjectId" UUID;

ALTER TABLE "OperationalEventStream" ADD COLUMN "productId" VARCHAR(48) NOT NULL DEFAULT 'agm-cockpit';
ALTER TABLE "OperationalEventStream" ADD COLUMN "moduleId" VARCHAR(80) NOT NULL DEFAULT 'premium-operations';
ALTER TABLE "OperationalEventStream" ADD COLUMN "subjectType" VARCHAR(64) NOT NULL DEFAULT 'TripContext';
ALTER TABLE "OperationalEventStream" ADD COLUMN "subjectId" UUID;

ALTER TABLE "OperationalEvent" ADD COLUMN "productId" VARCHAR(48) NOT NULL DEFAULT 'agm-cockpit';
ALTER TABLE "OperationalEvent" ADD COLUMN "moduleId" VARCHAR(80) NOT NULL DEFAULT 'premium-operations';
ALTER TABLE "OperationalEvent" ADD COLUMN "subjectType" VARCHAR(64) NOT NULL DEFAULT 'TripContext';
ALTER TABLE "OperationalEvent" ADD COLUMN "subjectId" UUID;

CREATE TABLE "CarMoverVehicleSubject" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "productId" VARCHAR(48) NOT NULL DEFAULT 'agm-car-mover',
  "vehicleClass" VARCHAR(48) NOT NULL,
  "vehicleType" VARCHAR(80) NOT NULL,
  "make" VARCHAR(120),
  "model" VARCHAR(120),
  "vin" VARCHAR(32),
  "registration" VARCHAR(32),
  "details" JSONB,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarMoverVehicleSubject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarMoverJob" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "productId" VARCHAR(48) NOT NULL DEFAULT 'agm-car-mover',
  "moduleId" VARCHAR(80) NOT NULL DEFAULT 'jobs',
  "subjectType" VARCHAR(64) NOT NULL DEFAULT 'CarMoverJob',
  "vehicleSubjectId" UUID NOT NULL,
  "pickupSnapshot" JSONB NOT NULL,
  "destinationSnapshot" JSONB NOT NULL,
  "sourceType" VARCHAR(48) NOT NULL DEFAULT 'manual',
  "sourceReference" VARCHAR(160),
  "currentState" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "lifecycleVersion" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" UUID NOT NULL,
  "assignedDriverUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarMoverJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_companyId_productId_subjectType_subjectId_occurredAt_idx" ON "AuditEvent"("companyId", "productId", "subjectType", "subjectId", "occurredAt");
CREATE INDEX "OperationalEventStream_companyId_productId_subjectType_subjectId_idx" ON "OperationalEventStream"("companyId", "productId", "subjectType", "subjectId");
CREATE INDEX "OperationalEvent_companyId_productId_subjectType_subjectId_occurredAt_idx" ON "OperationalEvent"("companyId", "productId", "subjectType", "subjectId", "occurredAt");
CREATE INDEX "CarMoverVehicleSubject_companyId_productId_vehicleClass_idx" ON "CarMoverVehicleSubject"("companyId", "productId", "vehicleClass");
CREATE INDEX "CarMoverVehicleSubject_companyId_productId_vin_idx" ON "CarMoverVehicleSubject"("companyId", "productId", "vin");
CREATE INDEX "CarMoverVehicleSubject_companyId_productId_registration_idx" ON "CarMoverVehicleSubject"("companyId", "productId", "registration");
CREATE INDEX "CarMoverJob_companyId_productId_currentState_updatedAt_idx" ON "CarMoverJob"("companyId", "productId", "currentState", "updatedAt");
CREATE INDEX "CarMoverJob_companyId_productId_vehicleSubjectId_idx" ON "CarMoverJob"("companyId", "productId", "vehicleSubjectId");
CREATE UNIQUE INDEX "CarMoverJob_companyId_productId_sourceType_sourceReference_key" ON "CarMoverJob"("companyId", "productId", "sourceType", "sourceReference");

ALTER TABLE "CarMoverVehicleSubject" ADD CONSTRAINT "CarMoverVehicleSubject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarMoverJob" ADD CONSTRAINT "CarMoverJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarMoverJob" ADD CONSTRAINT "CarMoverJob_vehicleSubjectId_fkey" FOREIGN KEY ("vehicleSubjectId") REFERENCES "CarMoverVehicleSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
