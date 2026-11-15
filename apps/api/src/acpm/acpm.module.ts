import { Body, Controller, Get, Inject, Module, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { AppendAcpmEventDto, AcpmQueryDto } from './acpm.dto';
import { AcpmObserver } from './acpm.observer';
import { AcpmService } from './acpm.service';

@Controller('agent-chain-performance')
@UseGuards(JwtAuthGuard)
export class AgentChainPerformanceController {
  constructor(@Inject(AcpmService) private readonly service: AcpmService) {}
  @Get() async read(@CurrentUser() ctx: RequestContext) { return {data:await this.service.snapshot(ctx)}; }
  @Post('events') async append(@Body() input: AppendAcpmEventDto,@CurrentUser() ctx: RequestContext) { return {data:await this.service.append(input,ctx)}; }
}
@Controller('acpm')
@UseGuards(JwtAuthGuard)
export class AcpmController {
  constructor(@Inject(AcpmService) private readonly service: AcpmService) {}
  @Get() async read(@CurrentUser() ctx: RequestContext,@Query() filters:AcpmQueryDto) { return {data:await this.service.monitor(ctx,filters)}; }
  @Post('events') async append(@Body() input: AppendAcpmEventDto,@CurrentUser() ctx: RequestContext) { return {data:await this.service.append(input,ctx)}; }
}
@Module({controllers:[AgentChainPerformanceController,AcpmController],providers:[AcpmService,AcpmObserver],exports:[AcpmObserver]})
export class AcpmModule {}
export { AcpmModule as AgentChainPerformanceModule };
