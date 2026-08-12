import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { AUTH_CONTRACT } from './auth.contract';
import { evaluateAccessEntitlements } from './access-entitlements.contract';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

const COOKIE = 'agm_refresh';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') @Throttle({ default: { limit: AUTH_CONTRACT.loginThrottle.limit, ttl: AUTH_CONTRACT.loginThrottle.ttlMs, blockDuration: AUTH_CONTRACT.loginThrottle.blockDurationMs } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) { const result = await this.auth.login(dto.email, dto.password); setCookie(response, result.rawRefreshToken); const { rawRefreshToken: _, ...safe } = result; return responseEnvelope(safe); }
  @Post('refresh') async refresh(@Req() request: Request) { return responseEnvelope(await this.auth.refresh(readCookie(request, COOKIE))); }
  @Post('logout') async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) { await this.auth.logout(readCookie(request, COOKIE)); response.clearCookie(COOKIE, { path: '/api/v1/auth' }); return responseEnvelope({ loggedOut: true }); }
  @Get('me') @UseGuards(JwtAuthGuard) me(@CurrentUser() user: RequestContext) { return responseEnvelope(user); }
  @Get('entitlements') @UseGuards(JwtAuthGuard) entitlements(@CurrentUser() user: RequestContext) { return responseEnvelope(evaluateAccessEntitlements({ subjectId: user.userId, roles: user.roles, evaluatedAt: new Date() })); }
}
function setCookie(response: Response, value: string) { response.cookie(COOKIE, value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: AUTH_CONTRACT.refreshSessionDays * 86400_000, path: '/api/v1/auth' }); }
function readCookie(request: Request, name: string) { const prefix = `${name}=`; return request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length); }
