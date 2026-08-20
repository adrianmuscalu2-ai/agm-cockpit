import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { configuredCorsOrigins } from '../config/environment';

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    if (!origin && process.env.NODE_ENV !== 'production') return true;
    const configured = process.env.CORS_ALLOWED_ORIGINS;
    if (!configured) throw new ForbiddenException('ORIGIN_POLICY_UNAVAILABLE');
    const allowed = new Set(configuredCorsOrigins(configured));
    if (!origin || !allowed.has(origin)) throw new ForbiddenException('UNTRUSTED_ORIGIN');
    return true;
  }
}
