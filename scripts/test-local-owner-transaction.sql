BEGIN;
DO $test$
DECLARE company_id uuid; owner_role uuid; premium_role uuid;
BEGIN
  SELECT "companyId" INTO company_id FROM "User" WHERE email='owner@agm.local' AND status='Active';
  SELECT id INTO owner_role FROM "Role" WHERE "companyId"=company_id AND code='company_owner' AND "isActive"=true;
  SELECT id INTO premium_role FROM "Role" WHERE "companyId"=company_id AND code='PREMIUM_ACCESS' AND "isActive"=true;
  IF company_id IS NULL OR owner_role IS NULL OR premium_role IS NULL THEN RAISE EXCEPTION 'LOCAL_REQUIRED_ROLE_MISSING'; END IF;
  INSERT INTO "User"(id,"companyId","displayName",email,"passwordHash",status,"personalDataStatus","createdAt","updatedAt") VALUES('11111111-1111-4111-8111-111111111111',company_id,'Transaction Test','transaction-test@agm.invalid','$2b$12$00000000000000000000000000000000000000000000000000000','Active','Active',now(),now());
  INSERT INTO "UserRole"(id,"companyId","userId","roleId","assignedByUserId","assignedAt") VALUES('22222222-2222-4222-8222-222222222222',company_id,'11111111-1111-4111-8111-111111111111',owner_role,'11111111-1111-4111-8111-111111111111',now());
  INSERT INTO "UserRole"(id,"companyId","userId","roleId","assignedByUserId","assignedAt") VALUES('33333333-3333-4333-8333-333333333333',company_id,'11111111-1111-4111-8111-111111111111',premium_role,'11111111-1111-4111-8111-111111111111',now());
END $test$;
ROLLBACK;
