import { Body, Controller, Get, Post } from '@nestjs/common';
import { responseEnvelope } from '../common/response';
import { TranslateTextDto } from './dto/translate-text.dto';
import { TranslationService } from './translation.service';
import { Throttle } from '@nestjs/throttler';
import { TRANSLATION_CONTRACT } from './translation.contract';

@Controller('translation')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Get('health')
  @Throttle({ default: {
    limit: TRANSLATION_CONTRACT.healthThrottle.limit,
    ttl: TRANSLATION_CONTRACT.healthThrottle.ttlMs,
    blockDuration: TRANSLATION_CONTRACT.healthThrottle.blockDurationMs,
  } })
  async health() {
    return responseEnvelope(await this.translationService.functionalHealth());
  }

  @Post('actions/translate-text')
  @Throttle({ default: {
    limit: TRANSLATION_CONTRACT.translateThrottle.limit,
    ttl: TRANSLATION_CONTRACT.translateThrottle.ttlMs,
    blockDuration: TRANSLATION_CONTRACT.translateThrottle.blockDurationMs,
  } })
  async translateText(@Body() dto: TranslateTextDto) {
    const result = await this.translationService.translateText(dto);
    return responseEnvelope(result);
  }
}
