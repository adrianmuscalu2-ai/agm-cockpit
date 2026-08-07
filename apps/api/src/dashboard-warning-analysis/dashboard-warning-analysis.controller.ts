import { BadRequestException, Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { responseEnvelope } from '../common/response';
import { validateVisionConsent, type VisionConsentEvidence } from '../common/image-security/vision-request-security';
import { DashboardWarningAnalysisService } from './dashboard-warning-analysis.service';

@Controller('dashboard-warning-analysis')
export class DashboardWarningAnalysisController {
  constructor(private readonly service: DashboardWarningAnalysisService) {}
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 60_000, blockDuration: 60_000 } })
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  async analyze(@UploadedFile() image: { buffer: Buffer; mimetype: string } | undefined, @Body('request') rawRequest?: string) {
    if (!image) throw new BadRequestException('IMAGE_REQUIRED');
    try { const request = JSON.parse(rawRequest ?? '{}') as { consent?: VisionConsentEvidence }; validateVisionConsent(request.consent); }
    catch { throw new BadRequestException('IMAGE_CONSENT_REQUIRED'); }
    return responseEnvelope(await this.service.analyze(image));
  }
}
