import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AcpmModule } from '../src/acpm/acpm.module';
import { AuthModule } from '../src/auth/auth.module';
import { validateEnvironment } from '../src/config/environment';
import { AgmatccCopilotModule } from '../src/agmatcc-copilot/agmatcc-copilot.module';
import { configureHttpApplication } from '../src/http-application';
import { API_CORE_CONTRACT } from '../src/api-core.contract';

if (process.env.NODE_ENV !== 'development') throw new Error('ACPM_LOCAL_BOOTSTRAP_REQUIRES_DEVELOPMENT');
if (process.env.API_HOST !== '127.0.0.1') throw new Error('ACPM_LOCAL_BOOTSTRAP_LOOPBACK_ONLY');
if (process.env.AGMATCC_COPILOT_ISOLATED_ENABLED !== 'true') throw new Error('ACPM_LOCAL_BOOTSTRAP_FEATURE_DISABLED');
if (!['simulated', 'openai'].includes(process.env.AGMATCC_COPILOT_PROVIDER ?? '')) throw new Error('ACPM_LOCAL_BOOTSTRAP_PROVIDER_NOT_ALLOWLISTED');
if (process.env.AGMATCC_COPILOT_PROVIDER === 'openai' && (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'LOCAL_ISOLATED_NO_KEY_CONFIG_SENTINEL')) throw new Error('ACPM_LOCAL_BOOTSTRAP_OPENAI_KEY_REQUIRED');
if (!process.env.ACPM_ISOLATED_SPOOL_DIR?.toUpperCase().startsWith('D:\\')) throw new Error('ACPM_LOCAL_BOOTSTRAP_D_DRIVE_SPOOL_REQUIRED');
const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(databaseUrl.hostname) || databaseUrl.port !== '55432' || databaseUrl.pathname !== '/agm_cockpit_191_rehearsal') throw new Error('ACPM_LOCAL_BOOTSTRAP_REHEARSAL_REQUIRED');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'], validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: API_CORE_CONTRACT.throttle.ttlMs, limit: API_CORE_CONTRACT.throttle.limit }]),
    AuthModule,
    AgmatccCopilotModule,
    AcpmModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class AgmatccIsolatedLocalModule {}

export async function createAgmatccRehearsalApp() {
  const app = await NestFactory.create(AgmatccIsolatedLocalModule, { rawBody: true });
  configureHttpApplication(app, app.get(ConfigService));
  await app.init();
  return app;
}

if (require.main === module) void createAgmatccRehearsalApp().then(app => app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1'));
