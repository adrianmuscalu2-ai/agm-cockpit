import { Body, Controller, Post } from '@nestjs/common';
import { responseEnvelope } from '../common/response';
import { TranslateTextDto } from './dto/translate-text.dto';
import { TranslationService } from './translation.service';
import { Throttle } from '@nestjs/throttler';

@Controller('translation')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post('actions/translate-text')
  @Throttle({ default: { limit: 20, ttl: 60_000, blockDuration: 60_000 } })
  async translateText(@Body() dto: TranslateTextDto) {
    const result = await this.translationService.translateText(dto);
    return responseEnvelope(result);
  }
}
