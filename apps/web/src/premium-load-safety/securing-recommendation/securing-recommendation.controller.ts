import { LoadSafetyApiError } from '../load-safety.api';
import type { LoadSafetyUiState } from '../load-safety.types';
import { requestSecuringRecommendation } from './securing-recommendation.api';
import { securingRecommendationState } from './securing-recommendation.state';
import type {
  OptionalChoice,
  SecuringRecommendationInput,
} from './securing-recommendation.types';

export function updateRecommendationInput(target: HTMLInputElement | HTMLSelectElement) {
  if (!target.closest('#securingRecommendationForm')) return false;
  const name = target.name as keyof SecuringRecommendationInput;
  if (!name) return false;
  const value = target.value.trim();

  if (target instanceof HTMLInputElement && target.type === 'number') {
    securingRecommendationState.input[name] = (value ? Number(value) : undefined) as never;
  } else if (name === 'antiSlipMats' || name === 'edgeProtectors' || name === 'stops') {
    securingRecommendationState.input[name] = value as OptionalChoice;
  } else {
    securingRecommendationState.input[name] = (value || undefined) as never;
  }
  return true;
}

export function toggleWhy(target: HTMLElement) {
  const control = target.closest<HTMLElement>('[data-why-id]');
  const id = control?.dataset.whyId;
  if (!id) return false;
  if (securingRecommendationState.expandedWhy.has(id)) securingRecommendationState.expandedWhy.delete(id);
  else securingRecommendationState.expandedWhy.add(id);
  return true;
}

export async function generateSecuringRecommendation(loadSafetyState: LoadSafetyUiState, language: string) {
  if (!loadSafetyState.image || !loadSafetyState.analysis || securingRecommendationState.processing) return false;
  securingRecommendationState.processing = true;
  try {
    securingRecommendationState.result = await requestSecuringRecommendation(
      loadSafetyState.image,
      language,
      securingRecommendationState.input,
      loadSafetyState.analysis,
    );
    securingRecommendationState.expandedWhy.clear();
    securingRecommendationState.statusKey = 'premium.loadSafety.recommendation.status.complete';
  } catch (error) {
    console.error('Premium securing recommendation failed.', error);
    securingRecommendationState.statusKey =
      error instanceof LoadSafetyApiError
        ? `premium.loadSafety.recommendation.status.${error.reason}`
        : 'premium.loadSafety.recommendation.status.failed';
  } finally {
    securingRecommendationState.processing = false;
  }
  return true;
}
