import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { AUTH_CONTRACT } from './auth.contract';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({
    default: {
      limit: AUTH_CONTRACT.loginThrottle.limit,
      ttl: AUTH_CONTRACT.loginThrottle.ttlMs,
      blockDuration: AUTH_CONTRACT.loginThrottle.blockDurationMs,
    },
  })
  async login(@Body() dto: LoginDto) {
    return responseEnvelope(await this.auth.login(dto.email, dto.password));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestContext) {
    return responseEnvelope(user);
  }
}
