import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { configuredCorsOrigins } from './config/environment';
import { API_CORE_CONTRACT } from './api-core.contract';

export function configureHttpApplication(app: Awaited<ReturnType<typeof NestFactory.create>>, config: ConfigService) {
  const expressApplication = app.getHttpAdapter().getInstance() as {
    disable(setting: string): void;
    set(setting: string, value: number): void;
  };
  expressApplication.disable('x-powered-by');
  expressApplication.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS', 0));

  app.use(helmet());
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.setHeader('CDN-Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    next();
  });
  const allowedOrigins = new Set(configuredCorsOrigins(config.getOrThrow<string>('CORS_ALLOWED_ORIGINS')));
  app.enableCors({
    credentials: true,
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
  });
  app.setGlobalPrefix(API_CORE_CONTRACT.globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
