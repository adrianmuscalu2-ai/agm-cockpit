import type { LoadSafetyAnalysis } from './premium-load-safety.types';

export function parseLoadSafetyAnalysis(value: unknown): LoadSafetyAnalysis | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const parsed = value as Partial<LoadSafetyAnalysis> & Record<string, unknown>;
  if (Object.keys(parsed).some((key) => !['correct', 'recommendations', 'risks'].includes(key))) return undefined;
  if (!isStringArray(parsed.correct) || !isStringArray(parsed.recommendations) || !isStringArray(parsed.risks)) {
    return undefined;
  }
  return {
    correct: parsed.correct.map(cleanObservation).filter(Boolean),
    recommendations: parsed.recommendations.map(cleanObservation).filter(Boolean),
    risks: parsed.risks.map(cleanObservation).filter(Boolean),
  };
}

export function parseLoadSafetyAnalysisJson(value: string | undefined): LoadSafetyAnalysis | undefined {
  if (!value) return undefined;
  try {
    return parseLoadSafetyAnalysis(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function cleanObservation(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 20 && value.every((item) => typeof item === 'string');
}
