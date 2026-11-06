export interface ApiBuildInfo {
  contract: 'agm-api-build-info.v1';
  appVersion: string;
  commit: string;
  buildId: string;
  builtAt: string | null;
}

// Values are baked into the image by the release pipeline; local runs report "unknown".
export function apiBuildInfo(env: NodeJS.ProcessEnv = process.env): ApiBuildInfo {
  const commit = env.AGM_BUILD_SHA?.trim() || 'unknown';
  return {
    contract: 'agm-api-build-info.v1',
    appVersion: '1.9.1',
    commit,
    buildId: env.AGM_BUILD_ID?.trim() || (commit === 'unknown' ? 'local' : `api-${commit.slice(0, 12)}`),
    builtAt: env.AGM_BUILD_TIME?.trim() || null,
  };
}
