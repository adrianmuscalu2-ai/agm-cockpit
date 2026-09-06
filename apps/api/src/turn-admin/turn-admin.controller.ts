import { Body, Controller, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsString, Length } from 'class-validator';
import { CsrfOriginGuard } from '../auth/csrf-origin.guard';
import { responseEnvelope } from '../common/response';
import { TURN_ADMIN_CONTRACT } from './turn-admin.contract';
import { TurnAdminService } from './turn-admin.service';
import { Throttle } from '@nestjs/throttler';

const COOKIE = 'agm_turn_refresh';

class UnlockTurnDto {
  @IsString()
  @Length(4, 64)
  pin!: string;
}

class ChangeTurnPinDto {
  @IsString()
  @Length(4, 64)
  currentPin!: string;

  @IsString()
  @Length(4, 64)
  newPin!: string;
}

@Controller('turn-admin')
@Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
export class TurnAdminController {
  constructor(private readonly service: TurnAdminService) {}

  @Post('unlock')
  async unlock(@Body() dto: UnlockTurnDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.service.unlock(dto.pin);
    setCookie(response, result.rawRefreshToken);
    return responseEnvelope(publicSession(result));
  }

  @Post('refresh')
  @UseGuards(CsrfOriginGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000, blockDuration: 10_000 } })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.service.refresh(readCookie(request, COOKIE));
    setCookie(response, result.rawRefreshToken);
    return responseEnvelope(publicSession(result));
  }

  @Post('logout')
  @UseGuards(CsrfOriginGuard)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.service.logout(readCookie(request, COOKIE));
    clearCookie(response);
    return responseEnvelope({ loggedOut: true });
  }

  @Post('validate')
  async validate(@Headers('authorization') authorization: string | undefined) {
    return responseEnvelope(await this.service.validate(authorization));
  }

  @Post('change-pin')
  async changePin(@Headers('authorization') authorization: string | undefined, @Body() dto: ChangeTurnPinDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.service.changePin(authorization, dto.currentPin, dto.newPin);
    clearCookie(response);
    return responseEnvelope(result);
  }
}

type IssuedSession = Awaited<ReturnType<TurnAdminService['unlock']>>;

function publicSession(result: IssuedSession) {
  return { accessToken: result.accessToken, expiresInSeconds: result.expiresInSeconds };
}

function setCookie(response: Response, value: string) {
  response.cookie(COOKIE, value, cookieOptions());
}

function clearCookie(response: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  response.clearCookie(COOKIE, options);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'none' as const,
    secure: true,
    maxAge: TURN_ADMIN_CONTRACT.refreshSessionDays * 86_400_000,
    path: '/api/v1/turn-admin',
  };
}

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length);
}
