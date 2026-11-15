import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { TurnAdminService } from '../turn-admin/turn-admin.service';

export const VERIFIED_LUNA_COMMANDER = Symbol('verified-luna-commander');
export type CommanderBinding = { familyHash: string };

/** Additional restriction only: the existing TURN verifier still owns authentication,
 * expiry, signature, rotation and revocation. Never derive authority from an unverified JWT. */
@Injectable()
export class LunaProductionAccessGuard implements CanActivate {
 constructor(private readonly config:ConfigService,private readonly turn:TurnAdminService) {}
 async canActivate(context:ExecutionContext) {
  if(process.env.NODE_ENV!=='production')return true;
  const request=context.switchToHttp().getRequest();
  if(this.config.get<string>('AGMATCC_LUNA_PRODUCTION_ENABLED')!=='true'||!request.user?.roles?.includes('TURN_ADMIN_SESSION'))throw new ForbiddenException('LUNA_COMMANDER_SESSION_REQUIRED');
  const authorization=request.headers.authorization;
  await this.turn.requireOperationalAccess(authorization);
  // Only after the canonical verifier succeeded, use its signed family binding.
  const payload=JSON.parse(Buffer.from(authorization.slice(7).split('.')[1],'base64url').toString('utf8'));
  const expected=this.config.get<string>('AGMATCC_LUNA_COMMANDER_FAMILY_SHA256');
  const familyHash=createHash('sha256').update(payload.familyId).digest('hex');
  if(!expected||!/^[a-f0-9]{64}$/.test(expected)||familyHash!==expected)throw new ForbiddenException('LUNA_COMMANDER_BINDING_MISMATCH');
  request[VERIFIED_LUNA_COMMANDER]={familyHash};return true;
 }
}
