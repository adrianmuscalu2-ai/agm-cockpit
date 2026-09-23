import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../machine-auth/github-actions-oidc.contract';
import { GitHubActionsOidcGuard } from '../machine-auth/github-actions-oidc.guard';
import { responseEnvelope } from '../common/response';
import { requestIdFromHeader } from '../common/request-ids';
import { TurnAdminService } from '../turn-admin/turn-admin.service';
import type { OperationalLinguistV1Request } from './operational-linguists-v1.contract';
import { OperationalLinguistsV1Service } from './operational-linguists-v1.service';

@Controller('operations/turn/operational-linguists')
export class OperationalLinguistsV1Controller {
  constructor(private readonly service: OperationalLinguistsV1Service, private readonly turnAdmin: TurnAdminService) {}

  @Post('publishers')
  @UseGuards(GitHubActionsOidcGuard)
  async register(@Req() request: OperationalLinguistV1Request, @Headers('x-request-id') requestId?: string) {
    return responseEnvelope(await this.service.registerPublisher(request.machineProvisioning), requestIdFromHeader(requestId));
  }

  @Post('heartbeats')
  @UseGuards(GitHubActionsOidcGuard)
  async heartbeat(@Body() body: unknown, @Req() request: OperationalLinguistV1Request, @Headers('x-request-id') requestId?: string) {
    return responseEnvelope(await this.service.heartbeat(body, request.machineProvisioning), requestIdFromHeader(requestId));
  }

  @Post('activation')
  @UseGuards(GitHubActionsOidcGuard)
  async activate(@Body() body: unknown, @Req() request: OperationalLinguistV1Request, @Headers('x-request-id') requestId?: string) {
    return responseEnvelope(await this.service.activate(body, request.machineProvisioning), requestIdFromHeader(requestId));
  }

  @Get('state')
  async state(@Headers('authorization') authorization: string | undefined, @Headers('x-request-id') requestId?: string) {
    await this.turnAdmin.requireOperationalAccess(authorization);
    return responseEnvelope(await this.service.state(GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId), requestIdFromHeader(requestId));
  }
}
