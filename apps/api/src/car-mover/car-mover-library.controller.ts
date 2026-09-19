import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { requestIdFromHeader } from '../common/request-ids';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { CarMoverLibraryService } from './car-mover-library.service';
import { CarMoverLibraryRequestDto } from './dto/car-mover-library-request.dto';

@Controller('car-mover/library')
@UseGuards(JwtAuthGuard)
export class CarMoverLibraryController {
  constructor(private readonly library: CarMoverLibraryService) {}

  @Post('resolve')
  async resolve(@CurrentUser() user: RequestContext, @Body() dto: CarMoverLibraryRequestDto, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.library.resolve(ctx, dto), ctx.requestId);
  }
}
