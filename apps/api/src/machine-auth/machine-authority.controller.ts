import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthorityControlPlaneService } from '../authority-control-plane/authority-control-plane.service';
import { responseEnvelope } from '../common/response';
import { CurrentMachine } from './current-machine.decorator';
import type { MachineRequestContext } from './machine-auth.contract';
import { MachineJwtAuthGuard } from './machine-jwt-auth.guard';

@Controller('m2m/authority-control-plane')
@UseGuards(MachineJwtAuthGuard)
export class MachineAuthorityController {
  constructor(private readonly authority: AuthorityControlPlaneService) {}

  @Get('companies/:companyId/network-registry')
  async registry(@Param('companyId', ParseUUIDPipe) companyId: string, @CurrentMachine() machine: MachineRequestContext) {
    if (companyId !== machine.companyId) throw new ForbiddenException('CROSS_COMPANY_ACCESS_DENIED');
    return responseEnvelope(await this.authority.registryReadOnly(machine.companyId), machine.requestId);
  }
}
