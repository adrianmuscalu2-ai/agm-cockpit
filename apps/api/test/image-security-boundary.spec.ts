import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const securitySources = [
  'image-sanitizer.ts',
  'vision-request-security.ts',
  'controlled-vision-transfer.ts',
  'vision-rate-limiter.ts',
].map((file) => readFileSync(resolve(__dirname, `../src/common/image-security/${file}`), 'utf8'));

describe('image security isolation boundary', () => {
  it('has no filesystem, persistence, cache, or unrestricted logging dependency', () => {
    const combined = securitySources.join('\n');
    expect(combined).not.toMatch(/from ['"]node:fs|from ['"]fs|Prisma|Repository|writeFile|appendFile/);
    expect(combined).not.toMatch(/console\.|Logger\b|Sentry|APM|trace\(/);
  });

  it('registers only the isolated Dashboard Warning module in the API runtime', () => {
    const appModule = readFileSync(resolve(__dirname, '../src/app.module.ts'), 'utf8');
    expect(appModule).not.toContain('image-security');
    expect(appModule).toContain('DashboardWarningAnalysisModule');
    expect(appModule).not.toContain('DashboardWarningAnalysisController');
  });
});
