import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { requestIdFromHeader } from '../common/request-ids';
import { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
@UseGuards(JwtAuthGuard)
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post()
  async create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.incidents.create(dto, ctx), ctx.requestId);
  }

  @Get()
  async list(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestIdHeader: string | undefined) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.incidents.list(ctx), ctx.requestId);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.incidents.get(id, ctx), ctx.requestId);
  }

  @Post(':id/actions/resolve')
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.incidents.resolve(id, dto, ctx), ctx.requestId);
  }

  private withRequestContext(user: RequestContext, requestIdHeader: string | undefined): RequestContext {
    return {
      ...user,
      requestId: requestIdFromHeader(requestIdHeader),
      correlationId: randomUUID(),
    };
  }
}
