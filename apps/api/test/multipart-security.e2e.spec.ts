import { CanActivate, ExecutionContext, ForbiddenException, INestApplication, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { request as httpRequest } from 'node:http';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PremiumCapabilityGuard } from '../src/auth/premium-capability.guard';
import { DashboardWarningAnalysisController } from '../src/dashboard-warning-analysis/dashboard-warning-analysis.controller';
import { DashboardWarningAnalysisService } from '../src/dashboard-warning-analysis/dashboard-warning-analysis.service';
import { FieldTestProvider } from '../src/premium-load-safety/field-test/field-test.provider';
import { PremiumLoadSafetyController } from '../src/premium-load-safety/premium-load-safety.controller';
import { PremiumLoadSafetyProvider } from '../src/premium-load-safety/premium-load-safety.provider';
import { SecuringRecommendationProvider } from '../src/premium-load-safety/securing-recommendation/securing-recommendation.provider';

const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: object }>();
    if (req.headers['x-test-auth'] !== 'yes') throw new UnauthorizedException();
    req.user = { userId: 'user-1', companyId: 'company-1', roles: ['PREMIUM_ACCESS'] };
    return true;
  }
}

class HeaderPremiumGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    if (req.headers['x-test-premium'] !== 'yes') throw new ForbiddenException('PREMIUM_ACCESS_REQUIRED');
    return true;
  }
}

describe('Multer 2.4 production multipart boundaries', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])],
      controllers: [DashboardWarningAnalysisController, PremiumLoadSafetyController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: DashboardWarningAnalysisService, useValue: { analyze: jest.fn().mockResolvedValue({ status: 'uncertain' }) } },
        { provide: PremiumLoadSafetyProvider, useValue: { analyze: jest.fn().mockResolvedValue({ available: true, provider: 'openai', analysis: { correct: [], recommendations: [], risks: [] } }) } },
        { provide: SecuringRecommendationProvider, useValue: { recommend: jest.fn().mockResolvedValue({ visibleStraps: { estimatedCount: null, recommendedCount: null, observations: [] }, recommendations: [], lcStf: [], additionalElements: [], missingData: [] }) } },
        { provide: FieldTestProvider, useValue: { analyze: jest.fn().mockResolvedValue({ observations: [], visibleRisks: [], recommendations: [], missingInformation: [], conflicts: [] }) } },
      ],
    })
      .overrideGuard(JwtAuthGuard).useClass(HeaderAuthGuard)
      .overrideGuard(PremiumCapabilityGuard).useClass(HeaderPremiumGuard)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => app.close());

  const authorized = (builder: request.Test) => builder.set('x-test-auth', 'yes').set('x-test-premium', 'yes');
  const consent = (purpose: string) => JSON.stringify({
    confirmed: true,
    purpose,
    policyVersion: purpose === 'dashboard-warning-analysis' ? 'dashboard-warning-privacy-v0.1' : 'load-safety-privacy-v0.1',
    providerPolicyVersion: 'provider-review-required-v0.1',
    consentedAt: new Date().toISOString(),
  });

  it('accepts valid uploads on every production multipart route', async () => {
    await authorized(request(app.getHttpServer()).post('/api/v1/dashboard-warning-analysis'))
      .field('request', JSON.stringify({ consent: JSON.parse(consent('dashboard-warning-analysis')) }))
      .attach('image', image, { filename: 'warning.jpg', contentType: 'image/jpeg' }).expect(200);
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .field('consent', consent('load-safety-analysis')).field('language', 'ro')
      .attach('image', image, { filename: 'load.jpg', contentType: 'image/jpeg' }).expect(200);
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/recommend'))
      .field('consent', consent('load-safety-recommendation')).field('language', 'ro').field('input', '{}')
      .attach('image', image, { filename: 'load.jpg', contentType: 'image/jpeg' }).expect(200);
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/field-test'))
      .field('consent', consent('load-safety-field-test')).field('language', 'ro')
      .field('roles', JSON.stringify(['front-oblique', 'rear-oblique'])).field('input', '{}')
      .attach('photos', image, { filename: 'front.jpg', contentType: 'image/jpeg' })
      .attach('photos', image, { filename: 'rear.jpg', contentType: 'image/jpeg' }).expect(200);
  });

  it('rejects missing, invalid, oversized, and duplicate files without a server error', async () => {
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .field('consent', consent('load-safety-analysis')).expect(400);
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .field('consent', consent('load-safety-analysis'))
      .attach('image', Buffer.from('not-image'), { filename: 'bad.txt', contentType: 'text/plain' }).expect(400);
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .field('consent', consent('load-safety-analysis'))
      .attach('image', Buffer.alloc(8 * 1024 * 1024 + 1), { filename: 'large.jpg', contentType: 'image/jpeg' }).expect(413);
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .field('consent', consent('load-safety-analysis'))
      .attach('image', image, { filename: 'one.jpg', contentType: 'image/jpeg' })
      .attach('image', image, { filename: 'two.jpg', contentType: 'image/jpeg' }).expect(400);
  });

  it('fails closed for crafted names and oversized array indexes, then remains healthy', async () => {
    for (const fieldName of ['payload[4294967294]', 'payload[0][nested]', 'payload[\"%0A\"]']) {
      const response = await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
        .field('consent', consent('load-safety-analysis')).field(fieldName, 'x')
        .attach('image', image, { filename: 'load.jpg', contentType: 'image/jpeg' });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .field('consent', consent('load-safety-analysis')).field('language', 'ro')
      .attach('image', image, { filename: 'healthy.jpg', contentType: 'image/jpeg' }).expect(200);
  });

  it('enforces authentication and Premium capability before multipart processing', async () => {
    await request(app.getHttpServer()).post('/api/v1/dashboard-warning-analysis')
      .attach('image', image, { filename: 'warning.jpg', contentType: 'image/jpeg' }).expect(401);
    await request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze')
      .set('x-test-auth', 'yes').attach('image', image, { filename: 'load.jpg', contentType: 'image/jpeg' }).expect(403);
  });

  it('returns a controlled error for malformed multipart and remains healthy', async () => {
    const malformed = await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .set('Content-Type', 'multipart/form-data; boundary=agm-boundary')
      .send('--agm-boundary\r\nContent-Disposition: form-data; name="image"; filename="x.jpg"\r\n');
    expect(malformed.status).toBeGreaterThanOrEqual(400);
    expect(malformed.status).toBeLessThan(500);
    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .field('consent', consent('load-safety-analysis')).attach('image', image, { filename: 'healthy.jpg', contentType: 'image/jpeg' }).expect(200);
  });

  it('cleans up an interrupted in-memory upload and continues serving requests', async () => {
    const server = await app.listen(0, '127.0.0.1');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_UNAVAILABLE');
    await new Promise<void>((resolve) => {
      const aborted = httpRequest({
        host: '127.0.0.1', port: address.port, method: 'POST',
        path: '/api/v1/premium/load-safety/actions/analyze',
        headers: {
          'content-type': 'multipart/form-data; boundary=agm-abort',
          'x-test-auth': 'yes',
          'x-test-premium': 'yes',
        },
      });
      aborted.on('error', () => resolve());
      aborted.on('close', () => resolve());
      aborted.write('--agm-abort\r\nContent-Disposition: form-data; name="image"; filename="partial.jpg"\r\nContent-Type: image/jpeg\r\n\r\n');
      aborted.write(Buffer.alloc(64 * 1024, 1));
      aborted.destroy();
    });

    await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
      .field('consent', consent('load-safety-analysis')).attach('image', image, { filename: 'healthy.jpg', contentType: 'image/jpeg' }).expect(200);
  });

  it('retains route throttling after the Multer upgrade', async () => {
    const responses = [];
    for (let index = 0; index < 11; index += 1) {
      responses.push(await authorized(request(app.getHttpServer()).post('/api/v1/premium/load-safety/actions/analyze'))
        .field('consent', consent('load-safety-analysis')).attach('image', image, { filename: `${index}.jpg`, contentType: 'image/jpeg' }));
    }
    expect(responses.filter((response) => response.status === 200)).toHaveLength(10);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
  });
});
