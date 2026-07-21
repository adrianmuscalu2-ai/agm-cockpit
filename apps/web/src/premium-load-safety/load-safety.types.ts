export type LoadSafetyCategory = 'correct' | 'recommendations' | 'risks';

export type LoadSafetyAnalysis = Record<LoadSafetyCategory, string[]>;

export type LoadSafetyUiState = {
  image?: File;
  previewUrl?: string;
  analysis?: LoadSafetyAnalysis;
  statusKey: string;
  processing: boolean;
};
