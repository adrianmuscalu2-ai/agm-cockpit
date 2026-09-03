import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { MachineRequestContext } from './machine-auth.contract';

export const CurrentMachine = createParamDecorator((_data: unknown, ctx: ExecutionContext): MachineRequestContext => {
  const request = ctx.switchToHttp().getRequest<{ user: MachineRequestContext }>();
  return request.user;
});
