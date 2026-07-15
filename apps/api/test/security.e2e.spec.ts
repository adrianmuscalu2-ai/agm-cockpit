import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { configureHttpApplication } from '../src/http-application';
import { TranslationController } from '../src/translation/translation.controller';
import { TranslationService } from '../src/translation/translation.service';
import { TurnAdminController } from '../src/turn-admin/turn-admin.controller';
import { TurnAdminService } from '../src/turn-admin/turn-admin.service';

describe('API perimeter', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])],
      controllers: [AuthController, TranslationController, TurnAdminController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: AuthService, useValue: { login: jest.fn().mockResolvedValue({ accessToken: 'test' }) } },
        {
          provide: TranslationService,
          useValue: { translateText: jest.fn().mockResolvedValue({ text: 'Hallo', available: true, provider: 'openai' }) },
        },
        {
          provide: TurnAdminService,
          useValue: {
            unlock: jest.fn().mockResolvedValue({ accessToken: 'admin', expiresInSeconds: 900 }),
            validate: jest.fn().mockResolvedValue({ valid: true }),
            changePin: jest.fn().mockResolvedValue({ changed: true }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    const config = new ConfigService({ TRUST_PROXY_HOPS: 0, CORS_ALLOWED_ORIGINS: 'https://localhost' });
    configureHttpApplication(app as Parameters<typeof configureHttpApplication>[0], config);
    await app.init();
  });

  afterEach(async () => app.close());

  it('allows the approved Capacitor origin and rejects an unknown web origin', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/translation/actions/translate-text')
      .set('Origin', 'https://localhost')
      .send({ text: 'Salut', sourceLanguage: 'ro', targetLanguage: 'de' })
      .expect('Access-Control-Allow-Origin', 'https://localhost')
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post('/api/v1/translation/actions/translate-text')
      .set('Origin', 'https://unapproved.example')
      .send({ text: 'Salut', sourceLanguage: 'ro', targetLanguage: 'de' });
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('throttles translation after twenty requests per minute', async () => {
    const responses = await Promise.all(
      Array.from({ length: 21 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/translation/actions/translate-text')
          .send({ text: 'Salut', sourceLanguage: 'ro', targetLanguage: 'de' }),
      ),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(20);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
  });

  it.each([
    ['/api/v1/auth/login', { email: 'owner@agm.test', password: 'correct-password' }],
    ['/api/v1/turn-admin/unlock', { pin: '123456' }],
  ])('throttles sensitive endpoint %s after five requests', async (path, body) => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => request(app.getHttpServer()).post(path).send(body)));
    expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
  });
});
