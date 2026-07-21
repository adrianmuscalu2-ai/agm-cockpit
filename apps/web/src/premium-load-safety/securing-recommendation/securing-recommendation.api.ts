import {
  LoadSafetyApiError,
  loadSafetyEndpointUrl,
} from '../load-safety.api';
import type { LoadSafetyAnalysis } from '../load-safety.types';
import type {
  SecuringRecommendation,
  SecuringRecommendationInput,
} from './securing-recommendation.types';

type RecommendationEnvelope = {
  data?: {
    available?: boolean;
    recommendation?: SecuringRecommendation;
  };
};

export const securingRecommendationEndpointUrl = loadSafetyEndpointUrl?.replace(
  /\/analyze$/,
  '/recommendation',
);

export async function requestSecuringRecommendation(
  image: File,
  language: string,
  input: SecuringRecommendationInput,
  visualAnalysis: LoadSafetyAnalysis,
) {
  if (!securingRecommendationEndpointUrl) throw new LoadSafetyApiError('configuration');
  const body = new FormData();
  body.append('image', image, image.name);
  body.append('language', language);
  body.append('input', JSON.stringify(input));
  body.append('visualAnalysis', JSON.stringify(visualAnalysis));

  let response: Response;
  try {
    response = await fetch(securingRecommendationEndpointUrl, { method: 'POST', body });
  } catch {
    throw new LoadSafetyApiError('network');
  }
  if (!response.ok) {
    if (response.status === 404) throw new LoadSafetyApiError('endpoint', response.status);
    if (response.status === 503) throw new LoadSafetyApiError('provider', response.status);
    throw new LoadSafetyApiError('request', response.status);
  }

  const payload = (await response.json()) as RecommendationEnvelope;
  if (!payload.data?.available || !payload.data.recommendation) {
    throw new LoadSafetyApiError('provider', response.status);
  }
  return payload.data.recommendation;
}
