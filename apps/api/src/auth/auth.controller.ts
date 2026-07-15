import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
  async login(@Body() dto: LoginDto) {
    return responseEnvelope(await this.auth.login(dto.email, dto.password));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestContext) {
    return responseEnvelope(user);
  }
}
