import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { requestIdFromHeader } from '../common/request-ids';
import { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { ActionReasonDto } from './dto/action-reason.dto';
import { CreateTransportDto } from './dto/create-transport.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { TransportsService } from './transports.service';

@Controller('transports')
@UseGuards(JwtAuthGuard)
export class TransportsController {
  constructor(private readonly transports: TransportsService) {}

  @Post()
  async create(
    @Body() dto: CreateTransportDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.create(dto, ctx), ctx.requestId);
  }

  @Get()
  async list(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestIdHeader: string | undefined) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.list(ctx), ctx.requestId);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.get(id, ctx), ctx.requestId);
  }

  @Post(':id/actions/accept')
  async accept(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.accept(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/arrive-pickup')
  async arrivePickup(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.arrivePickup(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/complete-pickup')
  async completePickup(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.completePickup(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/start-mission')
  async startMission(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.startMission(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/arrive-delivery')
  async arriveDelivery(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.arriveDelivery(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/complete-delivery')
  async completeDelivery(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.completeDelivery(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/submit-documents')
  async submitDocuments(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.submitDocuments(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/register-payment')
  async registerPayment(
    @Param('id') id: string,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.registerPayment(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/close-transport')
  async closeTransport(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.closeTransport(id, dto, ctx), ctx.requestId);
  }

  @Post(':id/actions/archive-transport')
  async archiveTransport(
    @Param('id') id: string,
    @Body() dto: ActionReasonDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.transports.archiveTransport(id, dto, ctx), ctx.requestId);
  }

  private withRequestContext(user: RequestContext, requestIdHeader: string | undefined): RequestContext {
    return {
      ...user,
      requestId: requestIdFromHeader(requestIdHeader),
      correlationId: randomUUID(),
    };
  }
}
