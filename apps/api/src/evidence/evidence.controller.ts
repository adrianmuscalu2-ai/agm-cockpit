import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { requestIdFromHeader } from '../common/request-ids';
import { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { CreateEvidenceMetadataDto } from './dto/create-evidence-metadata.dto';
import { EvidenceService } from './evidence.service';

@Controller('evidence')
@UseGuards(JwtAuthGuard)
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Post()
  async create(
    @Body() dto: CreateEvidenceMetadataDto,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.evidence.create(dto, ctx), ctx.requestId);
  }

  @Get()
  async list(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestIdHeader: string | undefined) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.evidence.list(ctx), ctx.requestId);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @CurrentUser() user: RequestContext,
    @Headers('x-request-id') requestIdHeader: string | undefined,
  ) {
    const ctx = this.withRequestContext(user, requestIdHeader);
    return responseEnvelope(await this.evidence.get(id, ctx), ctx.requestId);
  }

  private withRequestContext(user: RequestContext, requestIdHeader: string | undefined): RequestContext {
    return {
      ...user,
      requestId: requestIdFromHeader(requestIdHeader),
      correlationId: randomUUID(),
    };
  }
}
