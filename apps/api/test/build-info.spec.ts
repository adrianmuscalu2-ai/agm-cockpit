import { apiBuildInfo } from '../src/build-info';

describe('apiBuildInfo', () => {
  it('reports the pipeline-provided identity', () => {
    expect(
      apiBuildInfo({ AGM_BUILD_SHA: 'abcdef1234567890', AGM_BUILD_ID: 'api-7-1', AGM_BUILD_TIME: '2026-11-06T18:00:00Z' } as NodeJS.ProcessEnv),
    ).toEqual({
      contract: 'agm-api-build-info.v1',
      appVersion: '1.9.1',
      commit: 'abcdef1234567890',
      buildId: 'api-7-1',
      builtAt: '2026-11-06T18:00:00Z',
    });
  });

  it('reports an unknown local build without a commit', () => {
    expect(apiBuildInfo({} as NodeJS.ProcessEnv)).toMatchObject({ commit: 'unknown', buildId: 'local', builtAt: null });
  });
});
