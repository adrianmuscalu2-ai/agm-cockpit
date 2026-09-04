import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Logger,
  Optional,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PremiumCapabilityGuard } from '../auth/premium-capability.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { responseEnvelope } from '../common/response';
import type { RequestContext } from '../common/request-context';
import { validateVisionConsentForPurpose, type VisionConsentEvidence } from '../common/image-security/vision-request-security';
import { PrismaService } from '../prisma/prisma.service';
import { PremiumLoadSafetyProvider } from './premium-load-safety.provider';
import type { UploadedImage } from './premium-load-safety.types';
import { parseLoadSafetyAnalysisJson } from './premium-load-safety.validation';
import { SecuringRecommendationProvider } from './securing-recommendation/securing-recommendation.provider';
import {
  parseRecommendationInput,
} from './securing-recommendation/securing-recommendation.validation';
import { FieldTestProvider } from './field-test/field-test.provider';
import { finalizeFieldReport, parseFieldInput, parseFieldRoles } from './field-test/field-test.validation';

const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageBytes = 8 * 1024 * 1024;

@Controller('premium')
@UseGuards(JwtAuthGuard, PremiumCapabilityGuard)
export class PremiumLoadSafetyController {
  private readonly logger = new Logger(PremiumLoadSafetyController.name);

  constructor(
    private readonly provider: PremiumLoadSafetyProvider,
    private readonly recommendationProvider: SecuringRecommendationProvider,
    private readonly fieldTestProvider: FieldTestProvider,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  @Post(['ladungssicherung/analyze', 'load-safety/actions/analyze'])
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: maxImageBytes, files: 1 },
    }),
  )
  async analyze(
    @UploadedFile() image: UploadedImage | undefined,
    @Body('language') requestedLanguage?: string,
    @Body('consent') rawConsent?: string,
    @CurrentUser() user?: RequestContext,
  ) {
    requireConsent(rawConsent, 'load-safety-analysis');
    if (!image || !acceptedImageTypes.has(image.mimetype)) {
      throw new BadRequestException('A JPEG, PNG, or WEBP image is required.');
    }

    const language = normalizeLanguage(requestedLanguage);
    const result = await this.provider.analyze(image, language);
    await this.recordUsage(user, 'analysis', result.available ? 'SUCCESS' : 'PROVIDER_UNAVAILABLE');
    if (!result.available) {
      throw new ServiceUnavailableException('AI analysis provider is unavailable.');
    }
    return responseEnvelope(result);
  }

  @Post(['ladungssicherung/recommendation', 'load-safety/actions/recommend'])
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: maxImageBytes, files: 1 },
    }),
  )
  async recommend(
    @UploadedFile() image: UploadedImage | undefined,
    @Body('language') requestedLanguage?: string,
    @Body('input') rawInput?: string,
    @Body('visualAnalysis') rawVisualAnalysis?: string,
    @Body('consent') rawConsent?: string,
    @CurrentUser() user?: RequestContext,
  ) {
    requireConsent(rawConsent, 'load-safety-recommendation');
    if (!image || !acceptedImageTypes.has(image.mimetype)) {
      throw new BadRequestException('A JPEG, PNG, or WEBP image is required.');
    }

    let input;
    let visualAnalysis;
    try {
      input = parseRecommendationInput(rawInput);
      visualAnalysis = rawVisualAnalysis ? parseLoadSafetyAnalysisJson(rawVisualAnalysis) : undefined;
      if (rawVisualAnalysis && !visualAnalysis) throw new Error('Invalid visual analysis.');
    } catch {
      throw new BadRequestException('Recommendation data is invalid.');
    }

    const language = normalizeLanguage(requestedLanguage);
    const recommendation = await this.recommendationProvider.recommend(image, language, input, visualAnalysis);
    await this.recordUsage(user, 'recommendation', recommendation ? 'SUCCESS' : 'PROVIDER_UNAVAILABLE');
    if (!recommendation) {
      throw new ServiceUnavailableException('AI recommendation provider is unavailable.');
    }
    return responseEnvelope({ available: true, recommendation, provider: 'openai' });
  }

  @Post(['ladungssicherung/field-test', 'load-safety/actions/field-test'])
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 60_000, blockDuration: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('photos', 7, {
      limits: { fileSize: maxImageBytes, files: 7 },
    }),
  )
  async fieldTest(
    @UploadedFiles() photos: UploadedImage[] | undefined,
    @Body('roles') rawRoles?: string,
    @Body('input') rawInput?: string,
    @Body('language') requestedLanguage?: string,
    @Body('consent') rawConsent?: string,
    @CurrentUser() user?: RequestContext,
  ) {
    requireConsent(rawConsent, 'load-safety-field-test');
    if (!photos || photos.length < 2 || photos.some((photo) => !acceptedImageTypes.has(photo.mimetype))) {
      throw new BadRequestException('Two required JPEG, PNG, or WEBP lateral views are required.');
    }
    let roles;
    let input;
    try {
      roles = parseFieldRoles(rawRoles, photos.length);
      input = parseFieldInput(rawInput);
    } catch {
      throw new BadRequestException('Field test data is invalid.');
    }
    const language = normalizeLanguage(requestedLanguage);
    const report = await this.fieldTestProvider.analyze(
      photos.map((photo, index) => ({ ...photo, role: roles[index] })),
      input,
      language,
    );
    await this.recordUsage(user, 'field-test', report ? 'SUCCESS' : 'PROVIDER_UNAVAILABLE');
    if (!report) throw new ServiceUnavailableException('AI field test provider is unavailable.');
    return responseEnvelope({
      available: true,
      report: finalizeFieldReport(report, input, language),
      provider: 'openai',
    });
  }

  private async recordUsage(user: RequestContext | undefined, operation: string, outcome: string) {
    if (!this.prisma || !user) return;
    try {
      await this.prisma.providerUsageEvent.create({ data: {
        companyId: user.companyId,
        userId: user.userId,
        providerId: 'openai',
        adapterId: `premium-load-safety.${operation}`,
        category: 'PREMIUM_LOAD_SAFETY',
        eventType: 'PROVIDER_REQUEST',
        outcome,
      } });
    } catch (error) {
      this.logger.error('Premium load-safety usage telemetry could not be persisted.', error instanceof Error ? error.stack : undefined);
    }
  }
}

const supportedLanguages = new Set(['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq', 'it', 'es', 'sv']);

function normalizeLanguage(language: string | undefined) {
  return language && supportedLanguages.has(language) ? language : 'ro';
}

function requireConsent(rawConsent: string | undefined, purpose: 'load-safety-analysis' | 'load-safety-recommendation' | 'load-safety-field-test') {
  try {
    validateVisionConsentForPurpose(JSON.parse(rawConsent ?? '{}') as VisionConsentEvidence, purpose);
  } catch {
    throw new BadRequestException('IMAGE_CONSENT_REQUIRED');
  }
}
