import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestContext } from './request-context';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestContext => {
  const request = ctx.switchToHttp().getRequest<{ user: RequestContext }>();
  return request.user;
});
