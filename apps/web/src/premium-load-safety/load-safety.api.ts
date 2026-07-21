import type { LoadSafetyAnalysis } from './load-safety.types';

type LoadSafetyApiEnvelope = {
  data?: {
    available?: boolean;
    analysis?: LoadSafetyAnalysis;
  };
};

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
const configuredUrl = viteEnv?.VITE_AGM_API_BASE_URL;
const configuredBaseUrl = typeof configuredUrl === 'string' ? configuredUrl.trim() : undefined;
const developmentBaseUrl = viteEnv?.DEV === true ? 'http://127.0.0.1:3000/api/v1' : undefined;
const apiBaseUrl = (configuredBaseUrl || developmentBaseUrl)?.replace(/\/$/, '');

export const loadSafetyEndpointUrl = apiBaseUrl
  ? `${apiBaseUrl}/premium/ladungssicherung/analyze`
  : undefined;

export class LoadSafetyApiError extends Error {
  constructor(
    readonly reason: 'configuration' | 'network' | 'endpoint' | 'provider' | 'request',
    readonly status?: number,
  ) {
    super(`Load safety analysis failed: ${reason}${status ? ` (HTTP ${status})` : ''}.`);
  }
}

export async function analyzeLoadSafetyImage(image: File, language: string): Promise<LoadSafetyAnalysis> {
  if (!loadSafetyEndpointUrl) throw new LoadSafetyApiError('configuration');

  const body = new FormData();
  body.append('image', image, image.name);
  body.append('language', language);

  let response: Response;
  try {
    response = await fetch(loadSafetyEndpointUrl, { method: 'POST', body });
  } catch {
    throw new LoadSafetyApiError('network');
  }
  if (!response.ok) {
    if (response.status === 404) throw new LoadSafetyApiError('endpoint', response.status);
    if (response.status === 503) throw new LoadSafetyApiError('provider', response.status);
    throw new LoadSafetyApiError('request', response.status);
  }

  const payload = (await response.json()) as LoadSafetyApiEnvelope;
  if (!payload.data?.available || !payload.data.analysis) {
    throw new LoadSafetyApiError('provider', response.status);
  }

  return payload.data.analysis;
}
