import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestContext } from '../common/request-context';
import { evaluateAccessEntitlements } from './access-entitlements.contract';

@Injectable()
export class PremiumCapabilityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestContext }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('PREMIUM_ACCESS_REQUIRED');
    const entitlement = evaluateAccessEntitlements({
      subjectId: user.userId,
      roles: user.roles,
      evaluatedAt: new Date(),
    });
    if (entitlement.status !== 'active' || !entitlement.capabilities.includes('premium.load-safety')) {
      throw new ForbiddenException('PREMIUM_ACCESS_REQUIRED');
    }
    return true;
  }
}
