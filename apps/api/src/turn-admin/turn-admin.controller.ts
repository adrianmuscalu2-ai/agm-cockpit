import { Body, Controller, Headers, Post } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { responseEnvelope } from '../common/response';
import { TurnAdminService } from './turn-admin.service';

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
export class TurnAdminController {
  constructor(private readonly service: TurnAdminService) {}

  @Post('unlock')
  async unlock(@Body() dto: UnlockTurnDto) {
    return responseEnvelope(await this.service.unlock(dto.pin));
  }

  @Post('validate')
  async validate(@Headers('authorization') authorization: string | undefined) {
    return responseEnvelope(await this.service.validate(authorization));
  }

  @Post('change-pin')
  async changePin(@Headers('authorization') authorization: string | undefined, @Body() dto: ChangeTurnPinDto) {
    return responseEnvelope(await this.service.changePin(authorization, dto.currentPin, dto.newPin));
  }
}
