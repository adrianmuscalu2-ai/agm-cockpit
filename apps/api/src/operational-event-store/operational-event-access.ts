import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../machine-auth/github-actions-oidc.contract';
import { TURN_ADMIN_CONTRACT } from '../turn-admin/turn-admin.contract';
import { TurnAdminService } from '../turn-admin/turn-admin.service';

export type OperationalEventRight = 'read' | 'sync' | 'write';

// A TURN admin session may read and sync events of the TURN company only.
// Direct writes are not granted to it; no route currently requires 'write'.
export const OPERATIONAL_EVENT_RIGHTS = {
  turnAdminSession: ['read', 'sync'] as readonly OperationalEventRight[],
  turnAdminCompanyId: GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId as string,
  turnAdminPrincipal: 'turn-admin-session',
} as const;

export const OPERATIONAL_EVENT_RIGHT_KEY = 'operational-event-right';
export const RequireOperationalEventRight = (right: OperationalEventRight) => SetMetadata(OPERATIONAL_EVENT_RIGHT_KEY, right);

export function tokenScope(authorization: string | undefined): string | undefined {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const part = token.split('.')[1];
  if (!part) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { scope?: unknown };
    return typeof payload.scope === 'string' ? payload.scope : undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class OperationalEventAccessGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly turnAdmin: TurnAdminService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string | undefined = request.headers?.authorization;
    if (tokenScope(authorization) !== TURN_ADMIN_CONTRACT.tokenScope) {
      return (await super.canActivate(context)) as boolean;
    }
    const right = this.reflector.get<OperationalEventRight | undefined>(OPERATIONAL_EVENT_RIGHT_KEY, context.getHandler());
    if (!right) throw new UnauthorizedException();
    await this.turnAdmin.requireOperationalAccess(authorization);
    if (!OPERATIONAL_EVENT_RIGHTS.turnAdminSession.includes(right)) throw new ForbiddenException('Dreptul nu este acordat sesiunii TURN.');
    request.user = {
      userId: OPERATIONAL_EVENT_RIGHTS.turnAdminPrincipal,
      companyId: OPERATIONAL_EVENT_RIGHTS.turnAdminCompanyId,
      roles: ['TURN_ADMIN_SESSION'],
      requestId: '',
      correlationId: '',
    };
    return true;
  }
}
