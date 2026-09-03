import { Body, Controller, Headers, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GitHubActionsOidcGuard } from './github-actions-oidc.guard';
import { MachineAuthService } from './machine-auth.service';
import { MachineTokenRequestDto, ProvisionMachineIdentityDto, RevokeMachineCredentialDto, RotateMachineCredentialDto } from './machine-auth.dto';

@Controller('auth/machines')
@UseGuards(JwtAuthGuard)
export class MachineProvisioningController {
  constructor(private readonly machines: MachineAuthService) {}

  @Post()
  async provision(@Body() dto: ProvisionMachineIdentityDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.machines.provision(dto.subject, dto.expiresInDays, ctx), ctx.requestId);
  }

  @Post(':identityId/credentials/rotate')
  async rotate(@Param('identityId', ParseUUIDPipe) identityId: string, @Body() dto: RotateMachineCredentialDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.machines.rotate(identityId, dto.expiresInDays, ctx), ctx.requestId);
  }

  @Post(':identityId/credentials/:credentialId/revoke')
  async revoke(@Param('identityId', ParseUUIDPipe) identityId: string, @Param('credentialId', ParseUUIDPipe) credentialId: string, @Body() dto: RevokeMachineCredentialDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.machines.revoke(identityId, credentialId, dto.reason, ctx), ctx.requestId);
  }

  @Post(':identityId/revoke')
  async revokeIdentity(@Param('identityId', ParseUUIDPipe) identityId: string, @Body() dto: RevokeMachineCredentialDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.machines.revokeIdentity(identityId, dto.reason, ctx), ctx.requestId);
  }
}

@Controller('auth/deploy/machines')
@UseGuards(GitHubActionsOidcGuard)
export class DeploymentMachineProvisioningController {
  constructor(private readonly machines: MachineAuthService) {}

  @Post()
  async provision(@Body() dto: ProvisionMachineIdentityDto, @Req() request: DeploymentRequest, @Headers('x-request-id') requestId?: string) {
    const ctx = deploymentContext(request, requestId);
    return responseEnvelope(await this.machines.provision(dto.subject, dto.expiresInDays, ctx), ctx.requestId);
  }

  @Post(':identityId/credentials/rotate')
  async rotate(@Param('identityId', ParseUUIDPipe) identityId: string, @Body() dto: RotateMachineCredentialDto, @Req() request: DeploymentRequest, @Headers('x-request-id') requestId?: string) {
    const ctx = deploymentContext(request, requestId);
    return responseEnvelope(await this.machines.rotate(identityId, dto.expiresInDays, ctx), ctx.requestId);
  }

  @Post(':identityId/credentials/:credentialId/revoke')
  async revoke(@Param('identityId', ParseUUIDPipe) identityId: string, @Param('credentialId', ParseUUIDPipe) credentialId: string, @Body() dto: RevokeMachineCredentialDto, @Req() request: DeploymentRequest, @Headers('x-request-id') requestId?: string) {
    const ctx = deploymentContext(request, requestId);
    return responseEnvelope(await this.machines.revoke(identityId, credentialId, dto.reason, ctx), ctx.requestId);
  }

  @Post(':identityId/revoke')
  async revokeIdentity(@Param('identityId', ParseUUIDPipe) identityId: string, @Body() dto: RevokeMachineCredentialDto, @Req() request: DeploymentRequest, @Headers('x-request-id') requestId?: string) {
    const ctx = deploymentContext(request, requestId);
    return responseEnvelope(await this.machines.revokeIdentity(identityId, dto.reason, ctx), ctx.requestId);
  }
}

@Controller('auth/m2m')
export class MachineTokenController {
  constructor(private readonly machines: MachineAuthService) {}

  @Post('token')
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
  token(@Body() dto: MachineTokenRequestDto) {
    return this.machines.issueToken(dto.client_id, dto.client_secret);
  }
}

function context(user: RequestContext, requestId?: string): RequestContext {
  return { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
}

type DeploymentRequest = { machineProvisioning: RequestContext & { actorType: 'GitHubActionsOIDC'; actorSubject: string; actorMetadata: Record<string, string> } };
function deploymentContext(request: DeploymentRequest, requestId?: string) {
  return { ...request.machineProvisioning, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
}
