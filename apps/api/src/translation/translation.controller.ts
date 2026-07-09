import { Body, Controller, Post } from '@nestjs/common';
import { responseEnvelope } from '../common/response';
import { TranslateTextDto } from './dto/translate-text.dto';
import { TranslationService } from './translation.service';

@Controller('translation')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post('actions/translate-text')
  async translateText(@Body() dto: TranslateTextDto) {
    const result = await this.translationService.translateText(dto);
    return responseEnvelope(result);
  }
}
