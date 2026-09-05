import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../src/app.module';

describe('dashboard warning runtime activation', () => {
  it('registers the guarded Dashboard Warning analysis module', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as Array<{ name?: string }>;
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule) as Array<{ name?: string }>;
    expect(imports.map((entry) => entry?.name)).toContain('DashboardWarningAnalysisModule');
    expect(controllers.map((entry) => entry?.name)).not.toContain('DashboardWarningAnalysisController');
  });
});
