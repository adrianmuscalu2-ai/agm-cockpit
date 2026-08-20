import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { DataRightsService } from './data-rights.service';

@Controller('data-rights')
@UseGuards(JwtAuthGuard)
export class DataRightsController {
  constructor(private readonly rights: DataRightsService) {}
  @Get('me/export') exportSelf(@CurrentUser() user:RequestContext,@Res({passthrough:true}) response:Response) { response.setHeader('Cache-Control','private, no-store, max-age=0');response.setHeader('Content-Disposition','attachment; filename="agm-personal-data.json"');return this.rights.exportSelf(user).then(responseEnvelope); }
  @Get('me/requests') listSelf(@CurrentUser() user:RequestContext){return this.rights.listSelf(user).then(responseEnvelope);}
  @Patch('me') rectifySelf(@CurrentUser() user:RequestContext,@Body() body:{displayName?:string;phoneNumber?:string|null}){return this.rights.rectifySelf(user,body).then(responseEnvelope);}
  @Post('me/restrict') restrictSelf(@CurrentUser() user:RequestContext,@Body() body:{reason?:string}){return this.rights.restrictSelf(user,String(body.reason??'')).then(responseEnvelope);}
  @Post('me/object') objectSelf(@CurrentUser() user:RequestContext,@Body() body:{reason?:string}){return this.rights.objectSelf(user,String(body.reason??'')).then(responseEnvelope);}
  @Delete('me/account') deleteSelf(@CurrentUser() user:RequestContext) { return this.rights.deleteSelf(user).then(responseEnvelope); }
  @Post('me/requests/:id/retry-delete') retryDelete(@CurrentUser() user:RequestContext,@Param('id') id:string){return this.rights.retryDelete(user,id).then(responseEnvelope);}
}
