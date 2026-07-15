import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttpApplication } from './http-application';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureHttpApplication(app, config);
  const port = config.get<number>('PORT', 3000);
  const host = config.get<string>('API_HOST', '0.0.0.0');
  await app.listen(port, host);
}

if (require.main === module) {
  void bootstrap();
}
