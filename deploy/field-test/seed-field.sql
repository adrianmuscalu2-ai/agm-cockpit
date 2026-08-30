BEGIN;

INSERT INTO "Company"(id,"companyName","countryCode","defaultCurrencyCode",timezone,"isActive","createdAt","updatedAt")
VALUES('f1000000-0000-4000-8000-000000000001','AGM Controlled Field Validation','DE','EUR','Europe/Berlin',true,now(),now())
ON CONFLICT(id) DO NOTHING;

INSERT INTO "Role"(id,"companyId",code,"displayName",description,"isActive") VALUES
('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','PREMIUM_ACCESS','Field Tester','Controlled Car Mover field observation access.',true),
('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','OWNER','Field Validation Owner','Read-only field telemetry owner.',true)
ON CONFLICT(id) DO NOTHING;

INSERT INTO "User"(id,"companyId","displayName",email,"passwordHash",status,"personalDataStatus","createdAt","updatedAt") VALUES
('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','FIELD-TESTER-01','field-tester-01@field.invalid','FIELD_GATEWAY_ONLY','Active','Active',now(),now()),
('f3000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','FIELD-TESTER-02','field-tester-02@field.invalid','FIELD_GATEWAY_ONLY','Active','Active',now(),now()),
('f3000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001','FIELD-TESTER-03','field-tester-03@field.invalid','FIELD_GATEWAY_ONLY','Active','Active',now(),now()),
('f3000000-0000-4000-8000-00000000000f','f1000000-0000-4000-8000-000000000001','FIELD-OWNER','field-owner@field.invalid','FIELD_GATEWAY_ONLY','Active','Active',now(),now())
ON CONFLICT(id) DO NOTHING;

INSERT INTO "UserRole"(id,"companyId","userId","roleId","assignedByUserId") VALUES
('f4000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-00000000000f'),
('f4000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-00000000000f'),
('f4000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-00000000000f'),
('f4000000-0000-4000-8000-00000000000f','f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-00000000000f','f2000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-00000000000f')
ON CONFLICT(id) DO NOTHING;

WITH cases AS(SELECT n,('f5000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid vehicle_id,CASE (n-1)%3 WHEN 0 THEN 'f3000000-0000-4000-8000-000000000001'::uuid WHEN 1 THEN 'f3000000-0000-4000-8000-000000000002'::uuid ELSE 'f3000000-0000-4000-8000-000000000003'::uuid END tester_id FROM generate_series(1,120)n)
INSERT INTO "CarMoverVehicleSubject"(id,"companyId","productId","vehicleClass","vehicleType",details,"createdByUserId","createdAt","updatedAt")
SELECT vehicle_id,'f1000000-0000-4000-8000-000000000001','agm-car-mover','PASSENGER_CAR','FIELD_INPUT_REQUIRED',jsonb_build_object('fieldCaseNumber',n,'actualVehicleDataStored',false),tester_id,now(),now() FROM cases
ON CONFLICT(id) DO NOTHING;

WITH cases AS(SELECT n,('f5000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid vehicle_id,('f6000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid job_id,CASE (n-1)%3 WHEN 0 THEN 'f3000000-0000-4000-8000-000000000001'::uuid WHEN 1 THEN 'f3000000-0000-4000-8000-000000000002'::uuid ELSE 'f3000000-0000-4000-8000-000000000003'::uuid END tester_id FROM generate_series(1,120)n)
INSERT INTO "CarMoverJob"(id,"companyId","productId","moduleId","subjectType","vehicleSubjectId","pickupSnapshot","destinationSnapshot","sourceType","sourceReference","currentState","createdByUserId","createdAt","updatedAt")
SELECT job_id,'f1000000-0000-4000-8000-000000000001','agm-car-mover','field-measurement','CarMoverJob',vehicle_id,'{"label":"FIELD_INPUT_REQUIRED"}'::jsonb,'{"label":"FIELD_INPUT_REQUIRED"}'::jsonb,'field-validation','FIELD-CASE-'||lpad(n::text,4,'0'),'DRAFT',tester_id,now(),now() FROM cases
ON CONFLICT(id) DO NOTHING;

COMMIT;
