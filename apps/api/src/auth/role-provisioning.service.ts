import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestContext } from '../common/request-context';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const CAR_MOVER_ROLE = 'CAR_MOVER_ACCESS';

@Injectable()
export class RoleProvisioningService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async provisionCarMover(targetUserId: string, ctx: RequestContext) {
    if (!['OWNER', 'PRODUCT_OWNER'].some((role) => ctx.roles.includes(role))) {
      throw new ForbiddenException('Role provisioning requires OWNER or PRODUCT_OWNER.');
    }
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({ where: { id: targetUserId, companyId: ctx.companyId, status: 'Active' }, include: { roles: { include: { role: true } } } });
      if (!target) throw new NotFoundException('Target user not found in the current tenant.');
      const role = await tx.role.upsert({
        where: { companyId_code: { companyId: ctx.companyId, code: CAR_MOVER_ROLE } },
        update: { isActive: true, displayName: 'Car Mover Access', description: 'Approved Car Mover operational entitlement' },
        create: { companyId: ctx.companyId, code: CAR_MOVER_ROLE, displayName: 'Car Mover Access', description: 'Approved Car Mover operational entitlement', isActive: true },
      });
      const existing = target.roles.find((entry) => entry.roleId === role.id);
      const assignment = existing ?? await tx.userRole.create({ data: { companyId: ctx.companyId, userId: target.id, roleId: role.id, assignedByUserId: ctx.userId }, include: { role: true } });
      const audit = await this.audit.create({
        actionCode: existing ? 'car-mover-access-verified' : 'car-mover-access-provisioned',
        entityType: 'UserRole', entityId: assignment.id,
        reason: 'Controlled Car Mover entitlement provisioning.',
        beforeSnapshot: existing ? { role: CAR_MOVER_ROLE, active: true } : { role: CAR_MOVER_ROLE, active: false },
        afterSnapshot: { role: CAR_MOVER_ROLE, active: true, targetUserId: target.id },
        metadata: { controlPlane: 'AGM_ROLE_PROVISIONING', tenantId: ctx.companyId, evidence: 'AUDIT_EVENT' },
      }, ctx, tx as never);
      return { targetUserId: target.id, companyId: ctx.companyId, role: CAR_MOVER_ROLE, active: true, assignmentId: assignment.id, auditEventId: audit.id, idempotent: Boolean(existing) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
