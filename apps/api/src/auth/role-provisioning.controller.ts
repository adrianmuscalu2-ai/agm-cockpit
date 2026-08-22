import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RoleProvisioningService } from './role-provisioning.service';

class ProvisionCarMoverDto {
  @IsUUID()
  targetUserId!: string;
}

@Controller('auth/role-provisioning')
@UseGuards(JwtAuthGuard)
export class RoleProvisioningController {
  constructor(private readonly provisioning: RoleProvisioningService) {}

  @Post('car-mover')
  provision(@Body() dto: ProvisionCarMoverDto, @CurrentUser() ctx: RequestContext) {
    return this.provisioning.provisionCarMover(dto.targetUserId, ctx).then((result) => responseEnvelope(result, ctx.requestId));
  }
}
