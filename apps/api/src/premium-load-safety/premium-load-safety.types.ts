export type LoadSafetyAnalysis = {
  correct: string[];
  recommendations: string[];
  risks: string[];
};

export type LoadSafetyAnalysisResult = {
  available: boolean;
  analysis?: LoadSafetyAnalysis;
  provider: 'openai' | 'unavailable';
};

export type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};
