import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { mergeMap, type Observable } from 'rxjs';
import type { MachineRequestContext } from '../machine-auth/machine-auth.contract';
import { TurnOperationalTruthService } from './turn-operational-truth.service';

type MachineRequest = Request & { user?: MachineRequestContext };

@Injectable()
export class TurnOperationalTruthInterceptor implements NestInterceptor {
  constructor(private readonly truth: TurnOperationalTruthService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<MachineRequest>();
    if (request.method !== 'GET' || !isMachineAuthorityRegistryRoute(request.originalUrl)) return next.handle();
    return next.handle().pipe(mergeMap(async (responseBody) => {
      const machine = request.user;
      if (!machine?.machineIdentityId || !machine.credentialId || !machine.scopes.includes('acp:read')) return responseBody;
      const registryNodeCount = registryCount(responseBody);
      await this.truth.recordAuthenticatedAcpRead({
        machine,
        route: request.originalUrl.split('?')[0],
        responseBody,
        registryNodeCount,
      });
      return responseBody;
    }));
  }
}

function isMachineAuthorityRegistryRoute(value: string) {
  return /^\/api\/v1\/m2m\/authority-control-plane\/companies\/[0-9a-f-]+\/network-registry(?:\?|$)/i.test(value);
}

function registryCount(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const data = (value as { data?: unknown }).data;
  return Array.isArray(data) ? data.length : 0;
}
