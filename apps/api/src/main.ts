import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttpApplication } from './http-application';
import { API_CORE_CONTRACT } from './api-core.contract';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureHttpApplication(app, config);
  const port = config.get<number>('PORT', API_CORE_CONTRACT.defaultPort);
  const host = config.get<string>('API_HOST', API_CORE_CONTRACT.defaultHost.nonProduction);
  await app.listen(port, host);
}

if (require.main === module) {
  void bootstrap();
}
